import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      agency: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, agency, token } = response.data;
          
          localStorage.setItem('token', token);
          set({ user, agency, token, isAuthenticated: true, isLoading: false });
          return true;
        } catch (error) {
          set({ 
            error: error.response?.data?.message || 'Login failed', 
            isLoading: false 
          });
          return false;
        }
      },

      register: async (agencyName, email, password, confirmPassword) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', { 
            agencyName, email, password, confirmPassword 
          });
          const { user, agency, token } = response.data;
          
          localStorage.setItem('token', token);
          set({ user, agency, token, isAuthenticated: true, isLoading: false });
          return true;
        } catch (error) {
          set({ 
            error: error.response?.data?.message || 'Registration failed', 
            isLoading: false 
          });
          return false;
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        set({ user: null, agency: null, token: null, isAuthenticated: false });
        window.location.href = '/login';
      },

      clearError: () => set({ error: null })
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ user: state.user, agency: state.agency, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);

export default useAuthStore;
