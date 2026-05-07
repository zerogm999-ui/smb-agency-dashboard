import { useState } from 'react';
import Topbar from '../components/Topbar';
import useAuthStore from '../store/authStore';
import { User, Building, Lock } from 'lucide-react';
import './SettingsPage.css';

const SettingsPage = () => {
  const { user, agency } = useAuthStore();
  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="main-content">
      <Topbar title="Settings" />
      
      <div className="page-container settings-page">
        <div className="settings-layout glass-panel">
          
          <div className="settings-sidebar">
            <button 
              className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <User size={18} /> Profile & Account
            </button>
            <button 
              className={`settings-tab ${activeTab === 'agency' ? 'active' : ''}`}
              onClick={() => setActiveTab('agency')}
            >
              <Building size={18} /> Agency Details
            </button>
            <button 
              className={`settings-tab ${activeTab === 'security' ? 'active' : ''}`}
              onClick={() => setActiveTab('security')}
            >
              <Lock size={18} /> Security
            </button>
          </div>
          
          <div className="settings-content">
            {activeTab === 'profile' && (
              <div className="settings-section fade-in">
                <h3>Profile Settings</h3>
                <p className="section-desc">Manage your personal account details.</p>
                
                <form className="settings-form mt-4">
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Full Name</label>
                      <input type="text" className="form-input" defaultValue={user?.name || ''} placeholder="John Doe" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email Address</label>
                      <input type="email" className="form-input" defaultValue={user?.email || ''} readOnly />
                      <span className="form-desc mt-2 block text-xs text-slate-400">Email cannot be changed directly.</span>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Role</label>
                    <input type="text" className="form-input" defaultValue={user?.role || 'Admin'} readOnly disabled />
                  </div>
                  
                  <div className="settings-actions">
                    <button type="button" className="btn btn-primary">Save Changes</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'agency' && (
              <div className="settings-section fade-in">
                <h3>Agency Details</h3>
                <p className="section-desc">Update your agency information for reports and billing.</p>
                
                <form className="settings-form mt-4">
                  <div className="form-group">
                    <label className="form-label">Agency Name</label>
                    <input type="text" className="form-input" defaultValue={agency?.name || ''} />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Website URL</label>
                    <input type="url" className="form-input" placeholder="https://youragency.com" />
                  </div>
                  
                  <div className="settings-actions">
                    <button type="button" className="btn btn-primary">Save Agency Details</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-section fade-in">
                <h3>Security Settings</h3>
                <p className="section-desc">Manage your password and security preferences.</p>
                
                <form className="settings-form mt-4">
                  <div className="form-group">
                    <label className="form-label">Current Password</label>
                    <input type="password" className="form-input" />
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input type="password" className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Confirm New Password</label>
                      <input type="password" className="form-input" />
                    </div>
                  </div>
                  
                  <div className="settings-actions">
                    <button type="button" className="btn btn-primary">Update Password</button>
                  </div>
                </form>
                
                <hr className="divider" />
                
                <div className="danger-zone">
                  <h4>Danger Zone</h4>
                  <p>Permanently delete your agency account and all associated data.</p>
                  <button className="btn btn-danger mt-2">Delete Account</button>
                </div>
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
