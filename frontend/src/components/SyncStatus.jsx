import { RefreshCw, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useState } from 'react';
import api from '../services/api';
import useAuthStore from '../store/authStore';
import './SyncStatus.css';

const SyncStatus = ({ integrations, onSyncComplete }) => {
  const { agency } = useAuthStore();
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null); // 'success', 'error'

  const handleSyncAll = async () => {
    if (!agency) return;
    
    setSyncing(true);
    setSyncStatus(null);
    try {
      await api.post(`/sync/${agency.id}/all`);
      setSyncStatus('success');
      if (onSyncComplete) onSyncComplete();
    } catch (error) {
      console.error('Sync failed', error);
      setSyncStatus('error');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncStatus(null), 3000);
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'connected':
        return <CheckCircle size={14} strokeWidth={2.5} className="status-icon success" />;
      case 'error':
      case 'expired':
        return <XCircle size={14} strokeWidth={2.5} className="status-icon error" />;
      case 'syncing':
        return <RefreshCw size={14} strokeWidth={2.5} className="status-icon spinning info" />;
      default:
        return <Clock size={14} strokeWidth={2.5} className="status-icon warning" />;
    }
  };

  const formatLastSync = (dateString) => {
    if (!dateString) return 'Never synced';
    const date = new Date(dateString);
    return date.toLocaleString(undefined, { 
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="sync-status-container glass-panel">
      <div className="sync-header">
        <div>
          <h3>Data Synchronization</h3>
          <p className="sync-subtitle">Auto-sync runs daily at 6:00 AM UTC</p>
        </div>
        
        <button 
          className={`btn ${syncStatus === 'success' ? 'btn-success' : 'btn-primary'} sync-btn`} 
          onClick={handleSyncAll}
          disabled={syncing || !integrations?.length}
        >
          <RefreshCw size={12} className={syncing ? 'spinning' : ''} strokeWidth={2.5} />
          {syncing ? 'Syncing' : syncStatus === 'success' ? 'Synced' : 'Sync All'}
        </button>
      </div>

      <div className="sync-list">
        {!integrations || integrations.length === 0 ? (
          <p className="no-integrations">No platforms connected yet. Go to Integrations to connect.</p>
        ) : (
          integrations.map((int) => (
            <div key={int.id} className="sync-item">
              <div className="sync-platform-info">
                <div className={`platform-logo ${int.platform}`}></div>
                <div>
                  <div className="platform-name">{
                    int.platform.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
                  }</div>
                  <div className="last-sync">Last sync: {formatLastSync(int.lastSyncAt)}</div>
                </div>
              </div>
              
              <div className="sync-state">
                {getStatusIcon(int.status)}
                <span className={`status-text ${int.status?.toLowerCase()}`}>
                  {int.status || 'Pending'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SyncStatus;
