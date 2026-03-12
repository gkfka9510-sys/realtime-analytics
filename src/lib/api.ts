// API 클라이언트 - 백엔드 서버 통신
const API_BASE = '/api';

// ── 토큰 관리 ──
export const tokenManager = {
  get: () => localStorage.getItem('rice_token'),
  set: (t: string) => localStorage.setItem('rice_token', t),
  clear: () => localStorage.removeItem('rice_token'),
};

// ── 인증 만료 이벤트 (reload 대신 이벤트로 처리) ──
let _authExpiredFired = false;
export function onAuthExpired(handler: () => void) {
  window.addEventListener('rice:authExpired', handler, { once: true });
}
function fireAuthExpired() {
  if (!_authExpiredFired) {
    _authExpiredFired = true;
    window.dispatchEvent(new Event('rice:authExpired'));
    // 5초 후 재활성화 (재시도 가능)
    setTimeout(() => { _authExpiredFired = false; }, 5000);
  }
}

// ── 공통 fetch 래퍼 ──
async function apiFetch(path: string, options: RequestInit = {}) {
  const token = tokenManager.get();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);

    if (res.status === 401) {
      tokenManager.clear();
      fireAuthExpired(); // reload 대신 이벤트 발행
      throw new Error('인증 만료');
    }
    if (res.status === 429) {
      throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || '서버 오류');
    return data;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('요청 시간 초과');
    }
    throw err;
  }
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
  insert: (record: unknown) =>
    apiFetch('/sales', { method: 'POST', body: JSON.stringify(record) }),
  bulkInsert: (records: unknown[]) =>
    apiFetch('/sales/bulk', { method: 'POST', body: JSON.stringify({ records }) }),
  update: (id: string, record: unknown) =>
    apiFetch(`/sales/${id}`, { method: 'PUT', body: JSON.stringify(record) }),
  delete: (id: string) =>
    apiFetch(`/sales/${id}`, { method: 'DELETE' }),
  deleteAll: () =>
    apiFetch('/sales/all', { method: 'DELETE' }),
};

// ── 세금계산서 API ──
export const taxApi = {
  getAll: () => apiFetch('/tax-invoices'),
  insert: (invoice: unknown) =>
    apiFetch('/tax-invoices', { method: 'POST', body: JSON.stringify(invoice) }),
  update: (id: string, invoice: unknown) =>
    apiFetch(`/tax-invoices/${id}`, { method: 'PUT', body: JSON.stringify(invoice) }),
  delete: (id: string) =>
    apiFetch(`/tax-invoices/${id}`, { method: 'DELETE' }),
  bulkInsert: (invoices: unknown[]) =>
    apiFetch('/tax-invoices/bulk', { method: 'POST', body: JSON.stringify({ invoices }) }),
  deleteAll: () =>
    apiFetch('/tax-invoices/all', { method: 'DELETE' }),
};

// ── 품목/원가 API (쌀 원가 - 기존) ──
export const productApi = {
  getAll: () => apiFetch('/products'),
  save: (product: unknown) =>
    apiFetch('/products', { method: 'POST', body: JSON.stringify(product) }),
  update: (id: string, product: unknown) =>
    apiFetch(`/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  delete: (id: string) =>
    apiFetch(`/products/${id}`, { method: 'DELETE' }),
};

// ── 거래처 API ──
export const customerApi = {
  getAll: () => apiFetch('/customers'),
  save: (customer: unknown) =>
    apiFetch('/customers', { method: 'POST', body: JSON.stringify(customer) }),
  update: (id: string, customer: unknown) =>
    apiFetch(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(customer) }),
  delete: (id: string) =>
    apiFetch(`/customers/${id}`, { method: 'DELETE' }),
  bulkInsert: (customers: unknown[]) =>
    apiFetch('/customers/bulk', { method: 'POST', body: JSON.stringify({ customers }) }),
};

// ── 품목 API (기초데이터 - 신규) ──
export const itemApi = {
  getAll: () => apiFetch('/items'),
  save: (item: unknown) =>
    apiFetch('/items', { method: 'POST', body: JSON.stringify(item) }),
  update: (id: string, item: unknown) =>
    apiFetch(`/items/${id}`, { method: 'PUT', body: JSON.stringify(item) }),
  delete: (id: string) =>
    apiFetch(`/items/${id}`, { method: 'DELETE' }),
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

// ── 소매 단골 고객 API (retail - 매출/순이익 미반영) ──
export const retailCustomerApi = {
  getAll: () => apiFetch('/retail-customers'),
  save: (customer: unknown) =>
    apiFetch('/retail-customers', { method: 'POST', body: JSON.stringify(customer) }),
  update: (id: string, customer: unknown) =>
    apiFetch(`/retail-customers/${id}`, { method: 'PUT', body: JSON.stringify(customer) }),
  delete: (id: string) =>
    apiFetch(`/retail-customers/${id}`, { method: 'DELETE' }),
};

export const retailSaleApi = {
  getAll: (customerId?: string, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (customerId) params.set('customerId', customerId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return apiFetch(`/retail-sales?${params}`);
  },
  insert: (sale: unknown) =>
    apiFetch('/retail-sales', { method: 'POST', body: JSON.stringify(sale) }),
  update: (id: string, sale: unknown) =>
    apiFetch(`/retail-sales/${id}`, { method: 'PUT', body: JSON.stringify(sale) }),
  delete: (id: string) =>
    apiFetch(`/retail-sales/${id}`, { method: 'DELETE' }),
};

// ── 쇼핑몰 상품 API (관리자) ──
export const shopProductApi = {
  getAll: () => apiFetch('/shop/products/admin'),
  save: (product: unknown) =>
    apiFetch('/shop/products', { method: 'POST', body: JSON.stringify(product) }),
  update: (id: string, product: unknown) =>
    apiFetch(`/shop/products/${id}`, { method: 'PUT', body: JSON.stringify(product) }),
  delete: (id: string) =>
    apiFetch(`/shop/products/${id}`, { method: 'DELETE' }),
};

// ── 주문 API (관리자용) ──
export const orderApi = {
  getAll: (params?: { status?: string; from?: string; to?: string }) => {
    const p = new URLSearchParams();
    if (params?.status) p.set('status', params.status);
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    return apiFetch(`/orders?${p}`);
  },
  getStats: () => apiFetch('/orders/stats'),
  updateStatus: (id: string, status: string) =>
    apiFetch(`/orders/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }),
  delete: (id: string) =>
    apiFetch(`/orders/${id}`, { method: 'DELETE' }),
};
