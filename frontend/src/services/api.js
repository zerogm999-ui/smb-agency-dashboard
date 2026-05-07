import axios from 'axios';
import { isDemoLogin, mockApi } from './mockApi';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const isRelativeApi = API_URL === '/api';

const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add token to headers
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle token expiration
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 Unauthorized and not a retry yet
    if (error.response?.status === 401 && !originalRequest._retry && error.response?.data?.code === 'TOKEN_EXPIRED') {
      originalRequest._retry = true;
      try {
        const token = localStorage.getItem('token');
        const res = await axios.post(`${API_URL}/auth/refresh-token`, {}, {
          headers: { Authorization: `Bearer ${token}` }
        });

        if (res.data.token) {
          localStorage.setItem('token', res.data.token);
          client.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
          originalRequest.headers.Authorization = `Bearer ${res.data.token}`;
          return client(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, log out
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

const shouldUseMock = (error) => {
  const status = error.response?.status;
  return isRelativeApi && (!status || status === 404 || status === 405);
};

const api = {
  get: async (url, config) => {
    try {
      return await client.get(url, config);
    } catch (error) {
      if (shouldUseMock(error)) return mockApi.get(url, config);
      throw error;
    }
  },

  post: async (url, data, config) => {
    try {
      return await client.post(url, data, config);
    } catch (error) {
      if (url === '/auth/login' && !isDemoLogin(url, data)) {
        throw error;
      }
      if (shouldUseMock(error) || (isRelativeApi && isDemoLogin(url, data))) {
        return mockApi.post(url, data, config);
      }
      throw error;
    }
  },

  patch: async (url, data, config) => {
    try {
      return await client.patch(url, data, config);
    } catch (error) {
      if (shouldUseMock(error)) return mockApi.patch(url, data, config);
      throw error;
    }
  },

  delete: async (url, config) => {
    try {
      return await client.delete(url, config);
    } catch (error) {
      if (shouldUseMock(error)) return mockApi.delete(url, config);
      throw error;
    }
  },
};

export default api;
