// API 클라이언트 - 백엔드 서버 통신
const API_BASE = '/api';

// ── 토큰 관리 ──
export const tokenManager = {
  get: () => localStorage.getItem('rice_token'),
  set: (t: string) => localStorage.setItem('rice_token', t),
  clear: () => localStorage.removeItem('rice_token'),
};

// ── 공통 fetch 래퍼 ──
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = tokenManager.get();
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    tokenManager.clear();
    window.location.reload();
    throw new Error('인증 만료');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || '서버 오류');
  return data;
}

// ── 인증 API ──
export const authApi = {
  login: (username: string, password: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  register: (username: string, password: string, displayName?: string) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ username, password, displayName }) }),
  verify: () => apiFetch('/auth/verify'),
  changePassword: (currentPassword: string, newPassword: string) =>
    apiFetch('/auth/password', { method: 'PUT', body: JSON.stringify({ currentPassword, newPassword }) }),
};

// ── 스토리지 API ──
export const storageApi = {
  getStats: () => apiFetch('/storage/stats'),
  deleteOldSales: (months: number) =>
    apiFetch('/storage/sales/old', { method: 'DELETE', body: JSON.stringify({ months }) }),
  deleteOldInvTx: (months: number) =>
    apiFetch('/storage/inventory-tx/old', { method: 'DELETE', body: JSON.stringify({ months }) }),
  getDeleteLogs: () => apiFetch('/storage/delete-logs'),
};

// ── 매출 API ──
export const salesApi = {
  getAll: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return apiFetch(`/sales?${params}`);
  },
  bulkInsert: (records: unknown[]) =>
    apiFetch('/sales/bulk', { method: 'POST', body: JSON.stringify({ records }) }),
  deleteAll: () =>
    apiFetch('/sales/all', { method: 'DELETE' }),
};

// ── 세금계산서 API ──
export const taxApi = {
  getAll: () => apiFetch('/tax-invoices'),
  bulkInsert: (invoices: unknown[]) =>
    apiFetch('/tax-invoices/bulk', { method: 'POST', body: JSON.stringify({ invoices }) }),
  deleteAll: () =>
    apiFetch('/tax-invoices/all', { method: 'DELETE' }),
};

// ── 품목/원가 API ──
export const productApi = {
  getAll: () => apiFetch('/products'),
  save: (product: unknown) =>
    apiFetch('/products', { method: 'POST', body: JSON.stringify(product) }),
  update: (id: string, product: unknown) =>
    apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  delete: (id: string) =>
    apiFetch(`/products/${id}`, { method: 'DELETE' }),
};

// ── 재고 API ──
export const inventoryApi = {
  getAll: () => apiFetch('/inventory'),
  init: (data: { productId: string; productName: string; weightPerBag: number; quantity: number }) =>
    apiFetch('/inventory/init', { method: 'POST', body: JSON.stringify(data) }),
  update: (productId: string, data: unknown) =>
    apiFetch(`/inventory/${productId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getTransactions: (productId?: string) => {
    const params = new URLSearchParams({ limit: '500' });
    if (productId) params.set('productId', productId);
    return apiFetch(`/inventory/transactions?${params}`);
  },
  addTransaction: (tx: unknown) =>
    apiFetch('/inventory/transactions', { method: 'POST', body: JSON.stringify(tx) }),
};
