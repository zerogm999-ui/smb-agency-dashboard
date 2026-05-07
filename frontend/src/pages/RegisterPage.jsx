import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Activity, Building } from 'lucide-react';
import useAuthStore from '../store/authStore';
import './Auth.css';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    agencyName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const { register, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    if (formData.password !== formData.confirmPassword) {
      // Local validation
      return;
    }
    
    const success = await register(
      formData.agencyName, 
      formData.email, 
      formData.password, 
      formData.confirmPassword
    );
    
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
      
      <div className="auth-card glass-panel register-card">
        <div className="auth-header">
          <div className="auth-logo">
            <Activity size={32} color="white" />
          </div>
          <h2>Create Agency Account</h2>
          <p>Setup your centralized dashboard today</p>
        </div>

        {error && <div className="auth-alert">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Agency Name</label>
            <div className="input-with-icon">
              <Building size={18} className="input-icon" />
              <input 
                type="text" 
                name="agencyName"
                className="form-input" 
                placeholder="Acme Marketing"
                value={formData.agencyName}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Admin Email</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input 
                type="email" 
                name="email"
                className="form-input" 
                placeholder="admin@agency.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  name="password"
                  className="form-input" 
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input 
                  type="password" 
                  name="confirmPassword"
                  className="form-input" 
                  placeholder="••••••••"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary w-full auth-submit"
            disabled={isLoading}
          >
            {isLoading ? <div className="spinner auth-spinner"></div> : 'Register Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <span onClick={() => navigate('/login')} className="auth-link">Sign In</span></p>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
