

import axios from 'axios';

// Auto-detect working API base URL
const API_URLS = [
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_BASE_URL_EXTRA
].filter(Boolean);

let detectedApiBaseUrl = API_URLS[0];

export async function detectApiBaseUrl() {
  for (const url of API_URLS) {
    try {
      const res = await fetch(url + '/health');
      if (res.ok) {
        detectedApiBaseUrl = url;
        // eslint-disable-next-line no-console
        console.info('[api] Using API base URL:', url);
        return url;
      }
    } catch (e) {
      // Try next
    }
  }
  throw new Error('No working API URL found');
}

const api = axios.create({
  baseURL: detectedApiBaseUrl,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true
});

// Helper to get backend origin (strip trailing /api)
export const getBackendOrigin = () => detectedApiBaseUrl.replace(/\/api\/?$/, '');

// Normalize any accidental double /api prefixes (e.g., request to /api/devices when baseURL already ends with /api)
api.interceptors.request.use((config) => {
  if (config.url) {
    // Replace leading /api/ with / if baseURL already ends with /api
    if (detectedApiBaseUrl.endsWith('/api') && config.url.startsWith('/api/')) {
      config.url = config.url.replace(/^\/api\//, '/');
    }
    // Guard against resulting // paths
    config.url = config.url.replace(/\/\//g, '/');
  }
  return config;
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  console.error('Request interceptor error:', error);
  return Promise.reject(error);
});

// Authentication API endpoints
// (Removed duplicate authAPI declaration)

// Consolidated response interceptor (avoid duplicate logic)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest: any = error.config || {};
    const status = error.response?.status;
    const path = (originalRequest?.url || '').toString();

    // Helper: log once
    const debugPayload = {
      status,
      data: error.response?.data,
      message: error.message,
      url: path,
      method: originalRequest.method,
    };
    // eslint-disable-next-line no-console
    console.error('API Error:', debugPayload);

    // If 401 during explicit login/register attempt -> just reject so UI can show error (NO redirect)
    if (status === 401 && /\/auth\/(login|register)/.test(path)) {
      return Promise.reject(error.response?.data || error);
    }

    // Token expired flow (single retry)
    if (status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const refreshResp = await axios.post(`${detectedApiBaseUrl}/auth/refresh-token`, { refreshToken });
          if (refreshResp.data?.token) {
            localStorage.setItem('auth_token', refreshResp.data.token);
            api.defaults.headers.common['Authorization'] = `Bearer ${refreshResp.data.token}`;
            return api(originalRequest);
          }
        }
      } catch (refreshErr) {
        // eslint-disable-next-line no-console
        console.warn('Token refresh failed, clearing session');
      }
    }

    // Generic unauthorized (not login/register) -> clear & soft redirect only if a token had existed
    if (status === 401) {
      const hadToken = !!localStorage.getItem('auth_token');
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_data');
      if (hadToken && window.location.pathname !== '/login') {
        // SPA friendly redirect
        window.history.replaceState({}, '', '/login');
      }
    }

    return Promise.reject(error.response?.data || error);
  }
);

// Settings types
export interface NotificationSettings {
  email: {
    enabled: boolean;
    recipients: string[];
  };
  push: {
    enabled: boolean;
  };
}

export interface SecuritySettings {
  deviceOfflineThreshold: number;
  motionDetectionEnabled: boolean;
}

export interface Settings {
  notifications: NotificationSettings;
  security: SecuritySettings;
  created: string;
  lastModified: string;
}

// Settings API endpoints
// Settings endpoints (baseURL already ends with /api)
export const getSettings = () => api.get<Settings>('/settings');

export const updateSettings = (settings: Partial<Settings>) =>
  api.put<Settings>('/settings', settings);

// (Removed second duplicate response interceptor to prevent double handling / forced reloads)

// Device REST API endpoints
export const deviceAPI = {
  // Old deviceAPI methods
  updateStatus: (deviceId: string, status: any) =>
    api.post<{ success: boolean; device: any }>(`/device-api/${deviceId}/status`, status),

  sendCommand: (deviceId: string, command: { type: string, payload: any }) =>
    api.post<{ success: boolean }>(`/device-api/${deviceId}/command`, { command }),

  getCommands: (deviceId: string) =>
    api.get<{ commands: Array<{ type: string, payload: any }> }>(`/device-api/${deviceId}/commands`),

  // New deviceAPI methods
  getAllDevices: () => api.get('/devices'),

  createDevice: (deviceData: any) => api.post('/devices', deviceData),

  updateDevice: (deviceId: string, updates: any) =>
    api.put(`/devices/${deviceId}`, updates),

  deleteDevice: (deviceId: string) => api.delete(`/devices/${deviceId}`),

  toggleSwitch: (deviceId: string, switchId: string, state?: boolean) =>
    api.post(`/devices/${deviceId}/switches/${switchId}/toggle`, { state }),
  bulkToggle: (state: boolean) => api.post('/devices/bulk-toggle', { state }),
  bulkToggleByType: (type: string, state: boolean) => api.post(`/devices/bulk-toggle/type/${type}`, { state }),
  bulkToggleByLocation: (location: string, state: boolean) => api.post(`/devices/bulk-toggle/location/${encodeURIComponent(location)}`, { state }),

  getStats: () => api.get('/devices/stats'),
  // Secure admin-only: fetch single device with secret (?includeSecret=1)
  getDeviceWithSecret: (deviceId: string, pin?: string) =>
    api.get(`/devices/${deviceId}`, { params: { includeSecret: 1, secretPin: pin } }),
};

export const authAPI = {
  // Helper to build auth endpoint without risking double /api
  _url: (path: string) => `/auth${path}`.replace(/\/{2,}/g, '/'),
  login: (credentials: { email: string; password: string }) =>
    api.post('/auth/login', credentials),

  register: (userData: { name: string; email: string; password: string; role: string; department: string; employeeId?: string; phone?: string; designation?: string; reason?: string } | FormData) =>
    api.post('/auth/register', userData),

  getProfile: () => api.get('/auth/profile'),

  logout: () => api.post('/auth/logout'),

  updateProfile: (data: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => api.put('/auth/profile', data),

  deleteAccount: () => api.delete('/auth/profile'),

  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  resetPassword: (token: string, newPassword: string) =>
    api.post('/auth/reset-password', { token, newPassword }),

  getPendingPermissionRequests: () => api.get('/auth/permission-requests/pending'),

  approvePermissionRequest: (requestId: string, data: { comments?: string }) =>
    api.put(`/auth/permission-requests/${requestId}/approve`, data),

  rejectPermissionRequest: (requestId: string, data: { rejectionReason: string; comments?: string }) =>
    api.put(`/auth/permission-requests/${requestId}/reject`, data),

  getNotifications: (params?: { limit?: number; unreadOnly?: boolean }) =>
    api.get('/auth/notifications', { params }),

  markNotificationAsRead: (notificationId: string) =>
    api.put(`/auth/notifications/${notificationId}/read`),

  getUnreadNotificationCount: () => api.get('/auth/notifications/unread-count'),
};

export const scheduleAPI = {
  getAllSchedules: () => api.get('/schedules'),

  createSchedule: (scheduleData: any) => api.post('/schedules', scheduleData),

  updateSchedule: (scheduleId: string, updates: any) =>
    api.put(`/schedules/${scheduleId}`, updates),

  deleteSchedule: (scheduleId: string) => api.delete(`/schedules/${scheduleId}`),

  toggleSchedule: (scheduleId: string) => api.put(`/schedules/${scheduleId}/toggle`),
  runNow: (scheduleId: string) => api.post(`/schedules/${scheduleId}/run`),
};

export const activityAPI = {
  getActivities: (filters?: any) => api.get('/activities', { params: filters }),

  getDeviceActivities: (deviceId: string) => api.get(`/activities/device/${deviceId}`),

  getUserActivities: (userId: string) => api.get(`/activities/user/${userId}`),
};

export const securityAPI = {
  getAlerts: () => api.get('/security/alerts'),

  acknowledgeAlert: (alertId: string) => api.put(`/security/alerts/${alertId}/acknowledge`),

  createAlert: (alertData: any) => api.post('/security/alerts', alertData),
};

export const ticketAPI = {
  createTicket: (ticketData: {
    title: string;
    description: string;
    category: string;
    priority?: string;
    department?: string;
    location?: string;
    deviceId?: string;
    tags?: string[];
  }) => api.post('/tickets', ticketData),

  getTickets: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    priority?: string;
    search?: string;
  }) => api.get('/tickets', { params }),

  getTicket: (ticketId: string) => api.get(`/tickets/${ticketId}`),

  updateTicket: (ticketId: string, updates: {
    status?: string;
    assignedTo?: string;
    priority?: string;
    resolution?: string;
    estimatedHours?: number;
    actualHours?: number;
    comment?: string;
    isInternal?: boolean;
  }) => api.put(`/tickets/${ticketId}`, updates),

  deleteTicket: (ticketId: string) => api.delete(`/tickets/${ticketId}`),

  getTicketStats: () => api.get('/tickets/stats'),
};

export default api;
