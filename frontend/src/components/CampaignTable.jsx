import './CampaignTable.css';

const CampaignTable = ({ campaigns, loading }) => {
  const getStatusBadge = (status) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <span className="badge badge-success">Active</span>;
      case 'paused':
        return <span className="badge badge-warning">Paused</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  const getPlatformIcon = (platform) => {
    if (platform === 'google-ads') return 'Google';
    if (platform === 'meta-ads') return 'Meta';
    return platform;
  };

  if (loading) {
    return (
      <div className="table-loader glass-panel">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!campaigns || campaigns.length === 0) {
    return (
      <div className="empty-state glass-panel">
        <p>No campaigns found.</p>
      </div>
    );
  }

  return (
    <div className="table-container glass-panel">
      <div className="table-header">
        <h3>Top Campaigns</h3>
      </div>
      <div className="table-wrapper">
        <table className="campaign-table">
          <thead>
            <tr>
              <th>Campaign Name</th>
              <th>Platform</th>
              <th>Status</th>
              <th className="text-right">Spend</th>
              <th className="text-right">Conversions</th>
              <th className="text-right">Revenue</th>
              <th className="text-right">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c, idx) => {
              const spend = parseFloat(c.total_spend || c.spend || 0);
              const revenue = parseFloat(c.total_revenue || c.revenue || 0);
              const conversions = parseInt(c.total_conversions || c.conversions || 0);
              const roas = spend > 0 ? (revenue / spend).toFixed(2) : '0.00';
              
              return (
                <tr key={c.id || idx}>
                  <td className="campaign-name">
                    <div>{c.name || c.campaignName}</div>
                  </td>
                  <td>{getPlatformIcon(c.platform)}</td>
                  <td>{getStatusBadge(c.status || 'Active')}</td>
                  <td className="text-right">${spend.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-right">{conversions.toLocaleString()}</td>
                  <td className="text-right">${revenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="text-right font-bold">{roas}x</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CampaignTable;
