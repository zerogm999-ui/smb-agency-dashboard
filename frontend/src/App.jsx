import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Components
import Sidebar from './components/Sidebar';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import IntegrationsPage from './pages/IntegrationsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import CRMPage from './pages/CRMPage';

// Auth Guard
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return (
    <div className="app-container">
      <Sidebar />
      {children}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="/integrations" element={
          <ProtectedRoute>
            <IntegrationsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/reports" element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <SettingsPage />
          </ProtectedRoute>
        } />

        <Route path="/crm" element={
          <ProtectedRoute>
            <CRMPage />
          </ProtectedRoute>
        } />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
