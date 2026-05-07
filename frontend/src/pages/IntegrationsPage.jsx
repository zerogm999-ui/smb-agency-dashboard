import { useState, useEffect } from 'react';
import { Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import Topbar from '../components/Topbar';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import './IntegrationsPage.css';

const IntegrationsPage = () => {
  const { agency } = useAuthStore();
  const [integrations, setIntegrations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchIntegrations = async () => {
    if (!agency) return;
    try {
      const res = await api.get(`/integrations/${agency.id}`);
      setIntegrations(res.data.integrations);
    } catch (error) {
      console.error('Failed to fetch integrations', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [agency]);

  const handleConnect = async (platform) => {
    try {
      // In a real app, this returns an OAuth URL to redirect to
      const res = await api.post(`/integrations/${agency.id}/${platform}/authorize`);
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        // Mock fallback for demo
        alert(`Connected ${platform} successfully (Demo Mode)`);
        fetchIntegrations();
      }
    } catch (error) {
      console.error(`Failed to connect ${platform}`, error);
      alert(`Failed to connect to ${platform}. Check console for details.`);
    }
  };

  const handleDisconnect = async (integrationId) => {
    if (!window.confirm('Are you sure you want to disconnect this integration? Data will no longer sync.')) return;
    
    try {
      await api.delete(`/integrations/${agency.id}/${integrationId}`);
      fetchIntegrations();
    } catch (error) {
      console.error('Failed to disconnect', error);
    }
  };

  const platforms = [
    { id: 'google-ads', name: 'Google Ads', description: 'Sync campaigns, spend, and conversions.', logoClass: 'google-ads' },
    { id: 'meta-ads', name: 'Meta Ads', description: 'Sync Facebook and Instagram ad performance.', logoClass: 'meta-ads' },
    { id: 'stripe', name: 'Stripe', description: 'Sync revenue and transactions.', logoClass: 'stripe' },
    { id: 'hubspot', name: 'HubSpot', description: 'Sync CRM leads and deals.', logoClass: 'hubspot' }
  ];

  return (
    <div className="main-content">
      <Topbar title="Integrations Manager" />
      
      <div className="page-container">
        <div className="page-header">
          <div>
            <h2 className="page-title">Connected Platforms</h2>
            <p className="page-subtitle">Manage your data sources to keep your dashboard updated.</p>
          </div>
        </div>

        <div className="integrations-grid">
          {platforms.map(platform => {
            const connectedInt = integrations.find(i => i.platform === platform.id);
            const isConnected = !!connectedInt;
            const hasError = connectedInt?.status === 'error' || connectedInt?.status === 'expired';

            return (
              <div key={platform.id} className="integration-card glass-panel">
                <div className="integration-header">
                  <div className={`integration-logo ${platform.logoClass}`}></div>
                  <div className="integration-status">
                    {isConnected ? (
                      <span className={`badge ${hasError ? 'badge-error' : 'badge-success'}`}>
                        {hasError ? 'Action Needed' : 'Connected'}
                      </span>
                    ) : (
                      <span className="badge badge-info">Available</span>
                    )}
                  </div>
                </div>
                
                <div className="integration-body">
                  <h3>{platform.name}</h3>
                  <p>{platform.description}</p>
                  
                  {hasError && (
                    <div className="integration-error">
                      <AlertCircle size={14} />
                      <span>{connectedInt.errorMessage || 'Token expired. Please reconnect.'}</span>
                    </div>
                  )}
                </div>
                
                <div className="integration-footer">
                  {isConnected ? (
                    <button 
                      className="btn btn-danger w-full"
                      onClick={() => handleDisconnect(connectedInt.id)}
                    >
                      <Trash2 size={16} /> Disconnect
                    </button>
                  ) : (
                    <button 
                      className="btn btn-primary w-full"
                      onClick={() => handleConnect(platform.id)}
                    >
                      <Plus size={16} /> Connect Account
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default IntegrationsPage;
