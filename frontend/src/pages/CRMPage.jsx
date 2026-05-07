import { useState, useEffect } from 'react';
import useAuthStore from '../store/authStore';
import api from '../services/api';
import Topbar from '../components/Topbar';
import { User, Building, Mail, Tag, DollarSign, Calendar } from 'lucide-react';
import './CRMPage.css';

const CRMPage = () => {
  const { agency } = useAuthStore();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeads = async () => {
      if (!agency) return;
      try {
        const res = await api.get(`/crm/${agency.id}/leads?limit=20`);
        setLeads(res.data.leads);
      } catch (error) {
        console.error('Failed to fetch leads:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [agency]);

  const handleStatusChange = async (leadId, newStatus) => {
    try {
      await api.patch(`/crm/${agency.id}/leads/${leadId}`, { status: newStatus });
      // Update local state
      setLeads(leads.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
    } catch (error) {
      console.error('Failed to update lead status:', error);
    }
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'new': return '#5E6AD2';
      case 'mql': return '#7C3AED';
      case 'sql': return '#8B5CF6';
      case 'deal': return '#10B981';
      case 'closed_won': return '#059669';
      case 'closed_lost': return '#EF4444';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div className="main-content">
      <Topbar title="CRM & Lead Management" />
      
      <div className="page-container crm-page">
        <div className="crm-header-actions">
          <div className="search-box glass-panel">
            <input type="text" placeholder="Search leads, companies..." />
          </div>
          <button className="btn btn-primary">+ Add Manual Lead</button>
        </div>

        <div className="leads-list-container glass-panel">
          <div className="list-header">
            <h3>Recent Leads</h3>
            <span className="count">{leads.length} total</span>
          </div>

          <div className="leads-grid">
            {loading ? (
              <div className="page-loader"><div className="spinner"></div></div>
            ) : leads.length === 0 ? (
              <div className="empty-state"><p>No leads found.</p></div>
            ) : (
              leads.map((lead) => (
                <div key={lead.id} className="lead-card">
                  <div className="lead-card-header">
                    <div className="lead-avatar" style={{ backgroundColor: getStatusColor(lead.status) }}>
                      {lead.first_name?.[0]}{lead.last_name?.[0]}
                    </div>
                    <div className="lead-info">
                      <span className="lead-name">{lead.first_name} {lead.last_name}</span>
                      <span className="lead-company"><Building size={12} /> {lead.company}</span>
                    </div>
                    <select 
                      className="lead-status-select"
                      value={lead.status}
                      onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                      style={{ 
                        borderColor: getStatusColor(lead.status), 
                        color: getStatusColor(lead.status) 
                      }}
                    >
                      <option value="new">NEW</option>
                      <option value="mql">MQL</option>
                      <option value="sql">SQL</option>
                      <option value="deal">DEAL</option>
                      <option value="closed_won">WON</option>
                      <option value="closed_lost">LOST</option>
                    </select>
                  </div>
                  
                  <div className="lead-card-body">
                    <div className="lead-detail">
                      <Mail size={14} />
                      <span>{lead.email}</span>
                    </div>
                    <div className="lead-detail">
                      <Tag size={14} />
                      <span>{lead.campaign_name || 'Direct / Organic'}</span>
                    </div>
                    <div className="lead-detail">
                      <Calendar size={14} />
                      <span>{new Date(lead.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="lead-card-footer">
                    <div className="lead-value">
                      <DollarSign size={14} />
                      <span>{parseFloat(lead.value).toLocaleString()}</span>
                    </div>
                    <button className="btn-icon">View Profile</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CRMPage;
