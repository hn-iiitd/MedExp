const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const userId = localStorage.getItem('userId');
  const headers = {
    ...options.headers,
  };

  if (userId) {
    headers['x-user-id'] = userId;
  }

  // Don't set Content-Type for FormData (let browser set it with boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const error = new Error(data.error || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return res.json();
}

export const api = {
  // Auth
  getGoogleAuthUrl: () => request('/auth/google'),
  getCurrentUser: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),

  // Medicines
  getMedicines: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/medicines${query ? '?' + query : ''}`);
  },
  addMedicine: (data) =>
    request('/medicines', { method: 'POST', body: JSON.stringify(data) }),
  updateMedicine: (id, data) =>
    request(`/medicines/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteMedicine: (id) =>
    request(`/medicines/${id}`, { method: 'DELETE' }),
  deleteMedicines: (ids) =>
    request('/medicines', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  uploadBill: (file) => {
    const formData = new FormData();
    formData.append('bill', file);
    return request('/medicines/upload', { method: 'POST', body: formData });
  },

  // Emails
  fetchFromEmails: () => request('/emails/fetch', { method: 'POST' }),
  getEmailStatus: () => request('/emails/status'),
};
