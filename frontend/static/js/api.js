// api.js — Central API client for CrunchBox frontend
// All fetch wrappers use credentials: 'include' for session cookies

const API = {
  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Base GET helper.
   * @param {string} url - Relative URL
   * @returns {Promise<any>} Parsed JSON response
   */
  _get: async function (url) {
    const res = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `GET ${url} failed: ${res.status}`);
    return data;
  },

  /**
   * Base POST/PUT/DELETE helper for JSON bodies.
   * @param {string} url
   * @param {string} method
   * @param {object|null} body
   * @returns {Promise<any>}
   */
  _json: async function (url, method = 'POST', body = null) {
    const opts = {
      method,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== null) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `${method} ${url} failed: ${res.status}`);
    return data;
  },

  /**
   * Multipart FormData helper (no Content-Type header — browser sets it).
   * @param {string} url
   * @param {string} method
   * @param {FormData} formData
   * @returns {Promise<any>}
   */
  _multipart: async function (url, method = 'POST', formData) {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || `${method} ${url} failed: ${res.status}`);
    return data;
  },

  // ── Settings ──────────────────────────────────────────────────────────────

  /** GET /api/settings */
  getSettings: async function () {
    return API._get('/api/settings');
  },

  /** POST /api/settings */
  updateSettings: async function (data) {
    return API._json('/api/settings', 'POST', data);
  },

  // ── Auth ─────────────────────────────────────────────────────────────────

  /** POST /api/auth/login */
  login: async function (email, password) {
    return API._json('/api/auth/login', 'POST', { email, password });
  },

  /** POST /api/auth/register */
  register: async function (username, email, password) {
    return API._json('/api/auth/register', 'POST', { username, email, password });
  },

  /** POST /api/auth/logout */
  logout: async function () {
    return API._json('/api/auth/logout', 'POST');
  },

  /** GET /api/auth/me */
  getMe: async function () {
    return API._get('/api/auth/me');
  },

  /** PUT /api/auth/password */
  changePassword: async function (currentPassword, newPassword) {
    return API._json('/api/auth/password', 'PUT', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  getRewards: async function () {
    return API._get('/api/auth/rewards');
  },

  redeemReward: async function (rewardId) {
    return API._json('/api/auth/rewards/redeem', 'POST', { reward_id: rewardId });
  },

  // ── Menu ─────────────────────────────────────────────────────────────────

  /**
   * GET /api/menu
   * Returns [{id, name, icon, products: [...]}]
   */
  getMenu: async function () {
    return API._get('/api/menu');
  },

  /**
   * GET /api/products/search?q=...
   * @param {string} query
   */
  searchProducts: async function (query) {
    const encoded = encodeURIComponent(query);
    return API._get(`/api/products/search?q=${encoded}`);
  },

  // ── Orders ────────────────────────────────────────────────────────────────

  /**
   * POST /api/orders/validate-coupon
   * @param {string} code
   */
  validateCoupon: async function (code) {
    return API._json('/api/orders/validate-coupon', 'POST', { code });
  },

  /**
   * POST /api/orders/checkout
   * @param {object} payload
   */
  checkout: async function (payload) {
    return API._json('/api/orders/checkout', 'POST', payload);
  },

  /** GET /api/orders/history */
  getOrderHistory: async function () {
    return API._get('/api/orders/history');
  },

  /** GET /api/orders/yangon-locations */
  getLocations: async function () {
    return API._get('/api/orders/yangon-locations');
  },

  /** GET /api/locations — store branches with open/closed status */
  getBranchLocations: async function () {
    return API._get('/api/locations');
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  admin: {
    // ---- Products ----

    /** GET /api/admin/products */
    getProducts: async function () {
      return API._get('/api/admin/products');
    },

    /**
     * POST /api/admin/products (multipart)
     * @param {FormData} formData
     */
    addProduct: async function (formData) {
      return API._multipart('/api/admin/products', 'POST', formData);
    },

    /**
     * PUT /api/admin/products/:id (multipart)
     * @param {number|string} id
     * @param {FormData} formData
     */
    updateProduct: async function (id, formData) {
      return API._multipart(`/api/admin/products/${id}`, 'PUT', formData);
    },

    /**
     * DELETE /api/admin/products/:id
     * @param {number|string} id
     */
    deleteProduct: async function (id) {
      return API._json(`/api/admin/products/${id}`, 'DELETE');
    },

    // ---- Categories ----

    /** GET /api/admin/categories */
    getCategories: async function () {
      return API._get('/api/admin/categories');
    },

    /**
     * POST /api/admin/categories
     * @param {object} data
     */
    addCategory: async function (data) {
      return API._json('/api/admin/categories', 'POST', data);
    },

    /**
     * PUT /api/admin/categories/:id
     * @param {number|string} id
     * @param {object} data
     */
    updateCategory: async function (id, data) {
      return API._json(`/api/admin/categories/${id}`, 'PUT', data);
    },

    /**
     * DELETE /api/admin/categories/:id
     * @param {number|string} id
     */
    deleteCategory: async function (id) {
      return API._json(`/api/admin/categories/${id}`, 'DELETE');
    },

    // ---- Coupons ----

    /** GET /api/admin/coupons */
    getCoupons: async function () {
      return API._get('/api/admin/coupons');
    },

    /**
     * POST /api/admin/coupons
     * @param {object} data
     */
    addCoupon: async function (data) {
      return API._json('/api/admin/coupons', 'POST', data);
    },

    /**
     * DELETE /api/admin/coupons/:id
     * @param {number|string} id
     */
    deleteCoupon: async function (id) {
      return API._json(`/api/admin/coupons/${id}`, 'DELETE');
    },

    // ---- Orders ----

    /** GET /api/admin/orders */
    getOrders: async function () {
      return API._get('/api/admin/orders');
    },

    // ---- Branch Locations ----

    /** GET /api/admin/locations */
    getLocations: async function () {
      return API._get('/api/admin/locations');
    },

    /** POST /api/admin/locations (multipart) */
    addLocation: async function (formData) {
      return API._multipart('/api/admin/locations', 'POST', formData);
    },

    /** PUT /api/admin/locations/:id (multipart) */
    updateLocation: async function (id, formData) {
      return API._multipart(`/api/admin/locations/${id}`, 'PUT', formData);
    },

    /** DELETE /api/admin/locations/:id */
    deleteLocation: async function (id) {
      return API._json(`/api/admin/locations/${id}`, 'DELETE');
    },

    // ---- Logo ----

    /**
     * POST /api/admin/upload-logo (multipart)
     * @param {FormData} formData
     */
    uploadLogo: async function (formData) {
      return API._multipart('/api/admin/upload-logo', 'POST', formData);
    },

    uploadDecoration: async function (kind, formData) {
      return API._multipart(`/api/admin/upload-decoration/${encodeURIComponent(kind)}`, 'POST', formData);
    },
  },
};
