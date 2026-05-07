import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Link as LinkIcon, 
  FileText, 
  Settings, 
  LogOut,
  Users
} from 'lucide-react';
import useAuthStore from '../store/authStore';
import './Sidebar.css';

const Sidebar = () => {
  const location = useLocation();
  const { logout, agency } = useAuthStore();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/integrations', label: 'Integrations', icon: LinkIcon },
    { path: '/crm', label: 'CRM', icon: Users },
    { path: '/reports', label: 'Reports', icon: FileText },
    { path: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-container">
          <div className="logo-icon"></div>
          <h2>SMB Dashboard</h2>
        </div>
        <div className="agency-badge">
          {agency?.name || 'Agency Name'}
        </div>
      </div>

      <nav className="sidebar-nav">
        <ul>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            
            return (
              <li key={item.path}>
                <Link 
                  to={item.path} 
                  className={`nav-link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} strokeWidth={isActive ? 2.5 : 2} className="nav-icon" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="sidebar-footer">
        <button onClick={logout} className="logout-btn">
          <LogOut size={18} strokeWidth={2} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
