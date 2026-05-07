import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Activity } from 'lucide-react';
import useAuthStore from '../store/authStore';
import './Auth.css';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    if (!email || !password) return;
    
    const success = await login(email, password);
    if (success) {
      navigate('/');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-background">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>
      
      <div className="auth-card glass-panel">
        <div className="auth-header">
          <div className="auth-logo">
            <Activity size={32} color="white" />
          </div>
          <h2>Welcome Back</h2>
          <p>Sign in to your SMB Agency Dashboard</p>
        </div>

        {error && <div className="auth-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input 
                type="email" 
                className="form-input" 
                placeholder="admin@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full auth-submit"
            disabled={isLoading}
          >
            {isLoading ? <div className="spinner auth-spinner"></div> : 'Sign In'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Don't have an account? <span onClick={() => navigate('/register')} className="auth-link">Register Agency</span></p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
