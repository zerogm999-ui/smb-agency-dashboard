import { Bell, Search, User } from 'lucide-react';
import useAuthStore from '../store/authStore';
import './Topbar.css';

const Topbar = ({ title }) => {
  const { user } = useAuthStore();

  return (
    <header className="topbar">
      <div className="topbar-title">
        <h1>{title}</h1>
      </div>
      
      <div className="topbar-actions">
        <div className="search-bar">
          <Search size={14} className="search-icon" />
          <input type="text" placeholder="Search..." />
        </div>
        
        <button className="icon-btn">
          <Bell size={18} />
          <span className="badge-dot"></span>
        </button>
        
        <div className="user-profile">
          <div className="avatar">
            <User size={14} />
          </div>
          <div className="user-info">
            <span className="user-name">{user?.name || 'User'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Topbar;
