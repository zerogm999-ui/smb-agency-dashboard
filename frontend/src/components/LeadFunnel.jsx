import './LeadFunnel.css';

const LeadFunnel = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="funnel-loader glass-panel">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="empty-state glass-panel">
        <p>No CRM data available.</p>
      </div>
    );
  }

  // Calculate conversion rates
  const stagesWithRates = data.map((stage, index) => {
    const prevStage = data[index - 1];
    const conversionRate = prevStage ? (stage.count / prevStage.count) * 100 : null;
    return { ...stage, conversionRate };
  });

  return (
    <div className="lead-funnel-container glass-panel">
      <div className="funnel-header">
        <h3>Lead to Revenue Funnel</h3>
        <span className="subtitle">Lifecycle Performance</span>
      </div>
      
      <div className="funnel-body">
        {stagesWithRates.map((stage, index) => (
          <div key={stage.key} className="funnel-stage-wrapper">
            {stage.conversionRate !== null && (
              <div className="conversion-bridge">
                <span className="rate-badge">{stage.conversionRate.toFixed(1)}%</span>
              </div>
            )}
            
            <div className="funnel-stage-row">
              <div className="stage-label-col">
                <span className="stage-label">{stage.label}</span>
                <span className="stage-count">{stage.count.toLocaleString()}</span>
              </div>
              
              <div className="stage-visual-col">
                <div 
                  className="stage-bar" 
                  style={{ 
                    width: `${100 - index * 12}%`,
                    backgroundColor: stage.color,
                    opacity: 0.8 + (index * 0.05)
                  }}
                >
                  {stage.value > 0 && (
                    <span className="stage-value">
                      ${stage.value >= 1000 ? (stage.value / 1000).toFixed(1) + 'k' : stage.value.toFixed(0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="funnel-footer">
        <div className="total-metric">
          <span className="label">Total Revenue Won</span>
          <span className="value success">
            ${(data.find(d => d.key === 'closed_won')?.value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LeadFunnel;
