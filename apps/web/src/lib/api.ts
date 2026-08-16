import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4001/api';

// Origin that serves uploaded files (/uploads/...). Behind nginx the SPA, the
// API and the uploads share a single origin, so this is VITE_API_URL without
// its trailing /api. Never hardcode a host here: an absolute http://localhost
// URL is unreachable from a user's browser and is blocked as mixed content on
// an HTTPS page.
export const FILE_BASE = API_URL.replace(/\/api\/?$/, '');

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Flag to prevent multiple redirections
let isRedirecting = false;

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Don't add token to auth endpoints (login, register, refresh)
    // Check both the URL path and the full URL to be safe
    const url = config.url || '';
    const fullUrl = config.baseURL ? `${config.baseURL}${url}` : url;
    const isAuthEndpoint = 
      url.includes('/auth/login') || 
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      fullUrl.includes('/auth/login') ||
      fullUrl.includes('/auth/register') ||
      fullUrl.includes('/auth/refresh');
    
    // Debug logging in development
    if (import.meta.env.DEV && isAuthEndpoint) {
      console.log('🔍 [API Interceptor] Auth endpoint detected:', {
        url,
        fullUrl,
        baseURL: config.baseURL,
        method: config.method,
        hasAuthHeader: !!config.headers.Authorization,
      });
    }
    
    // Explicitly remove Authorization header for auth endpoints
    if (isAuthEndpoint) {
      // Force remove Authorization header
      delete config.headers.Authorization;
      delete config.headers.authorization; // lowercase version
      
      if (import.meta.env.DEV) {
        console.log('✅ [API Interceptor] Removed Authorization header for auth endpoint');
        console.log('📤 [API Interceptor] Final headers:', {
          ...config.headers,
          Authorization: undefined,
        });
      }
    } else {
      // Only add token for non-auth endpoints
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      } else {
        // Ensure no stale Authorization header exists
        delete config.headers.Authorization;
        delete config.headers.authorization;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Don't redirect on 401 for login endpoint - let the login page handle the error
    const isLoginRequest = error.config?.url?.includes('/auth/login');
    const isOnLoginPage = window.location.pathname === '/login';
    
    // Only handle 401 once to avoid redirect loops, and skip if it's a login request
    if (error.response?.status === 401 && !isRedirecting && !isLoginRequest && !isOnLoginPage) {
      isRedirecting = true;
      
      // Clear all auth data
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('auth-storage');
      
      // Redirect to login after a short delay.
      // BASE_URL (« /app/ » en production, « / » en dev) est indispensable :
      // une redirection en dur vers « /login » enverrait l'utilisateur sur la
      // page de connexion d'Odoo, servie à la racine du même domaine.
      setTimeout(() => {
        window.location.href = `${import.meta.env.BASE_URL}login`.replace(/\/{2,}/g, '/');
        isRedirecting = false;
      }, 100);
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: (data: any) =>
    api.post('/auth/login', data),
  
  getProfile: () =>
    api.get('/auth/me'),
  
  logout: () =>
    api.post('/auth/logout'),
  
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.post('/auth/change-password', data),
};

// Students API
export const studentsApi = {
  getAll: (params?: any) =>
    api.get('/students', { params }),
  
  getById: (id: string) =>
    api.get(`/students/${id}`),
  
  create: (data: any) =>
    api.post('/students', data),
  
  update: (id: string, data: any) =>
    api.put(`/students/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/students/${id}`),
};

// Classes API
export const classesApi = {
  getAll: () =>
    api.get('/classes'),
  
  getById: (id: string) =>
    api.get(`/classes/${id}`),
  
  create: (data: any) =>
    api.post('/classes', data),
  
  update: (id: string, data: any) =>
    api.put(`/classes/${id}`, data),
};

// Subjects API
export const subjectsApi = {
  getAll: () =>
    api.get('/subjects'),
  
  create: (data: any) =>
    api.post('/subjects', data),
  
  update: (id: string, data: any) =>
    api.put(`/subjects/${id}`, data),
};

// Dashboard API
export const dashboardApi = {
  getStats: () =>
    api.get('/dashboard/stats'),
  
  getActivities: () =>
    api.get('/dashboard/activities'),
};

// Users API
export const usersApi = {
  getAll: (params?: any) =>
    api.get('/users', { params }),
  
  update: (id: string, data: any) =>
    api.put(`/users/${id}`, data),
};
