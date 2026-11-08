// Admin dashboard behavior for categories, menu items, promotions and settings.
const Admin = {
  categories: [],
  products: [],
  coupons: [],
  orders: [],
  editingProductId: '',

  init: async function () {
    try {
      const session = await API.getMe();
      if (!session.logged_in || !session.user.is_admin) {
        window.location.href = '/';
        return;
      }
    } catch (error) {
      console.error('[Admin] Could not verify admin session:', error);
      window.location.href = '/';
      return;
    }

    document.querySelectorAll('.admin-nav [data-tab]').forEach((button) => {
      button.addEventListener('click', () => Admin.switchTab(button.dataset.tab));
    });
    document.getElementById('add-product-btn')?.addEventListener('click', () => Admin.showProductForm());
    document.getElementById('product-cancel-btn')?.addEventListener('click', () => Admin.hideProductForm());
    document.getElementById('product-form')?.addEventListener('submit', Admin.saveProduct);
    document.getElementById('product-is-combo')?.addEventListener('change', (event) => {
      document.getElementById('combo-discount-group')?.classList.toggle('hidden', !event.target.checked);
    });
    document.getElementById('add-category-btn')?.addEventListener('click', () => Admin.showCategoryForm());
    document.getElementById('category-cancel-btn')?.addEventListener('click', () => Admin.hideCategoryForm());
    document.getElementById('category-form')?.addEventListener('submit', Admin.saveCategory);
    document.getElementById('add-coupon-btn')?.addEventListener('click', () => {
      document.getElementById('coupon-form-wrap')?.classList.remove('hidden');
    });
    document.getElementById('coupon-cancel-btn')?.addEventListener('click', () => {
      document.getElementById('coupon-form-wrap')?.classList.add('hidden');
    });
    document.getElementById('coupon-form')?.addEventListener('submit', Admin.saveCoupon);
    document.getElementById('settings-form')?.addEventListener('submit', Admin.saveSettings);
    document.getElementById('settings-logo')?.addEventListener('change', Admin.uploadLogo);
    document.getElementById('settings-hero-image')?.addEventListener('change', (event) => Admin.uploadDecoration(event, 'hero'));
    document.getElementById('settings-featured-image')?.addEventListener('change', (event) => Admin.uploadDecoration(event, 'featured'));
    document.getElementById('settings-deal-image')?.addEventListener('change', (event) => Admin.uploadDecoration(event, 'deal'));
    document.getElementById('refresh-orders-btn')?.addEventListener('click', () => Admin.loadOrders());
    document.getElementById('sidebar-toggle')?.addEventListener('click', () => {
      document.getElementById('admin-sidebar')?.classList.toggle('open');
    });
    document.getElementById('admin-logout-btn')?.addEventListener('click', Admin.logout);
    Admin.switchTab('dashboard');
  },

  logout: async function () {
    const button = document.getElementById('admin-logout-btn');
    if (button) button.disabled = true;
    try {
      await API.logout();
      window.location.replace('/');
    } catch (error) {
      Admin.toast(`Could not log out: ${error.message}`, 'error');
      if (button) button.disabled = false;
    }
  },

  switchTab: function (name) {
    document.querySelectorAll('.admin-tab-content').forEach((panel) => {
      panel.classList.toggle('hidden', panel.id !== `tab-${name}`);
    });
    document.querySelectorAll('.admin-nav [data-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.tab === name);
    });
    const title = document.getElementById('admin-page-title');
    if (title) title.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    const loaders = {
      dashboard: Admin.loadDashboard,
      products: Admin.loadProducts,
      categories: Admin.loadCategories,
      coupons: Admin.loadCoupons,
      orders: Admin.loadOrders,
      settings: Admin.loadSettings,
    };
    loaders[name]?.();
  },

  loadDashboard: async function () {
    try {
      const [products, categories, coupons, orders] = await Promise.all([
        API.admin.getProducts(), API.admin.getCategories(), API.admin.getCoupons(), API.admin.getOrders(),
      ]);
      Admin.products = products;
      Admin.categories = categories;
      Admin.coupons = coupons;
      Admin.orders = orders;
      Admin.setText('stat-total-products', products.length);
      Admin.setText('stat-total-orders', orders.length);
      Admin.setText('stat-total-categories', categories.length);
      Admin.setText('stat-active-coupons', coupons.filter((coupon) => coupon.is_active).length);
      const rows = document.getElementById('dashboard-orders-body');
      if (rows) rows.innerHTML = Admin.orderRows(orders.slice(0, 5));
    } catch (error) {
      Admin.toast(`Could not load dashboard: ${error.message}`, 'error');
    }
  },

  loadProducts: async function () {
    try {
      [Admin.products, Admin.categories] = await Promise.all([
        API.admin.getProducts(), API.admin.getCategories(),
      ]);
      const select = document.getElementById('product-category');
      if (select) {
        const selected = select.value;
        select.replaceChildren(new Option('Select Category', ''));
        Admin.categories.forEach((category) => select.add(new Option(`${category.icon} ${category.name}`, category.id)));
        select.value = selected;
      }
      const tbody = document.getElementById('products-tbody');
      if (!tbody) return;
      if (!Admin.products.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-empty">No products yet.</td></tr>';
        return;
      }
      tbody.innerHTML = Admin.products.map((product) => `
        <tr>
          <td>${product.image_url
            ? `<img class="table-thumb" src="${Admin.escape(product.image_url)}" alt="${Admin.escape(product.name)}">`
            : '<span aria-label="No product image">🍗</span>'}</td>
          <td>${Admin.escape(product.name)}</td>
          <td>${Admin.escape(product.category_name)}</td>
          <td>${Admin.price(product.price)}</td>
          <td>${product.is_combo ? `Yes (${Number(product.combo_discount_pct)}% off)` : 'No'}</td>
          <td class="actions-cell">
            <button type="button" class="btn-edit" data-edit-product="${Admin.escape(product.id)}">Edit</button>
            <button type="button" class="btn-delete" data-delete-product="${Admin.escape(product.id)}">Delete</button>
          </td>
        </tr>`).join('');
      tbody.querySelectorAll('[data-edit-product]').forEach((button) => {
        button.addEventListener('click', () => Admin.editProduct(button.dataset.editProduct));
      });
      tbody.querySelectorAll('[data-delete-product]').forEach((button) => {
        button.addEventListener('click', () => Admin.deleteProduct(button.dataset.deleteProduct));
      });
    } catch (error) {
      Admin.toast(`Could not load products: ${error.message}`, 'error');
    }
  },

  showProductForm: function () {
    Admin.editingProductId = '';
    document.getElementById('product-form')?.reset();
    document.getElementById('product-id').value = '';
    document.getElementById('product-submit-btn').textContent = 'Save Product';
    document.getElementById('combo-discount-group')?.classList.add('hidden');
    document.getElementById('product-form-wrap')?.classList.remove('hidden');
  },

  editProduct: function (id) {
    const product = Admin.products.find((item) => item.id === id);
    if (!product) return;
    Admin.editingProductId = id;
    document.getElementById('product-id').value = id;
    document.getElementById('product-name').value = product.name;
    document.getElementById('product-category').value = product.category_id;
    document.getElementById('product-desc').value = product.description;
    document.getElementById('product-price').value = product.price;
    document.getElementById('product-is-combo').checked = product.is_combo;
    document.getElementById('product-combo-discount').value = product.combo_discount_pct;
    document.getElementById('combo-discount-group')?.classList.toggle('hidden', !product.is_combo);
    document.getElementById('product-submit-btn').textContent = 'Update Product';
    document.getElementById('product-form-wrap')?.classList.remove('hidden');
  },

  saveProduct: async function (event) {
    event.preventDefault();
    const button = document.getElementById('product-submit-btn');
    const form = event.currentTarget;
    button.disabled = true;
    try {
      const body = new FormData();
      body.append('category_id', document.getElementById('product-category').value);
      body.append('name', document.getElementById('product-name').value.trim());
      body.append('description', document.getElementById('product-desc').value.trim());
      body.append('price', document.getElementById('product-price').value);
      body.append('is_combo', String(document.getElementById('product-is-combo').checked));
      body.append('combo_discount_pct', document.getElementById('product-combo-discount').value || '0');
      const image = document.getElementById('product-image').files[0];
      if (image) body.append('image', image);
      if (Admin.editingProductId) await API.admin.updateProduct(Admin.editingProductId, body);
      else await API.admin.addProduct(body);
      Admin.toast('Product saved.', 'success');
      form.reset();
      Admin.hideProductForm();
      await Admin.loadProducts();
    } catch (error) {
      Admin.toast(`Could not save product: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
    }
  },

  hideProductForm: function () {
    document.getElementById('product-form-wrap')?.classList.add('hidden');
    document.getElementById('product-form')?.reset();
    Admin.editingProductId = '';
  },

  deleteProduct: async function (id) {
    if (!window.confirm('Delete this product?')) return;
    try {
      await API.admin.deleteProduct(id);
      await Admin.loadProducts();
      Admin.toast('Product deleted.', 'success');
    } catch (error) {
      Admin.toast(`Could not delete product: ${error.message}`, 'error');
    }
  },

  loadCategories: async function () {
    try {
      Admin.categories = await API.admin.getCategories();
      const tbody = document.getElementById('categories-tbody');
      if (!tbody) return;
      tbody.innerHTML = Admin.categories.map((category) => `
        <tr>
          <td>${Admin.escape(category.icon)}</td>
          <td>${Admin.escape(category.name)}</td>
          <td>${Admin.products.filter((item) => item.category_id === category.id).length || '—'}</td>
          <td class="actions-cell">
            <button type="button" class="btn-edit" data-edit-category="${Admin.escape(category.id)}">Edit</button>
            <button type="button" class="btn-delete" data-delete-category="${Admin.escape(category.id)}">Delete</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="4" class="table-empty">No categories yet.</td></tr>';
      tbody.querySelectorAll('[data-edit-category]').forEach((button) => {
        button.addEventListener('click', () => Admin.editCategory(button.dataset.editCategory));
      });
      tbody.querySelectorAll('[data-delete-category]').forEach((button) => {
        button.addEventListener('click', () => Admin.deleteCategory(button.dataset.deleteCategory));
      });
    } catch (error) {
      Admin.toast(`Could not load categories: ${error.message}`, 'error');
    }
  },

  showCategoryForm: function () {
    document.getElementById('category-form')?.reset();
    document.getElementById('category-id').value = '';
    document.getElementById('category-form-wrap')?.classList.remove('hidden');
  },

  editCategory: function (id) {
    const category = Admin.categories.find((item) => item.id === id);
    if (!category) return;
    document.getElementById('category-id').value = id;
    document.getElementById('category-icon').value = category.icon;
    document.getElementById('category-name').value = category.name;
    document.getElementById('category-form-wrap')?.classList.remove('hidden');
  },

  saveCategory: async function (event) {
    event.preventDefault();
    const id = document.getElementById('category-id').value;
    const data = {
      icon: document.getElementById('category-icon').value.trim(),
      name: document.getElementById('category-name').value.trim(),
    };
    try {
      if (id) await API.admin.updateCategory(id, data);
      else await API.admin.addCategory(data);
      document.getElementById('category-form-wrap')?.classList.add('hidden');
      await Admin.loadCategories();
      Admin.toast('Category saved.', 'success');
    } catch (error) {
      Admin.toast(`Could not save category: ${error.message}`, 'error');
    }
  },

  hideCategoryForm: function () {
    document.getElementById('category-form-wrap')?.classList.add('hidden');
    document.getElementById('category-form')?.reset();
  },

  deleteCategory: async function (id) {
    if (!window.confirm('Delete this category and its products?')) return;
    try {
      await API.admin.deleteCategory(id);
      await Admin.loadCategories();
      Admin.toast('Category deleted.', 'success');
    } catch (error) {
      Admin.toast(`Could not delete category: ${error.message}`, 'error');
    }
  },

  loadCoupons: async function () {
    try {
      Admin.coupons = await API.admin.getCoupons();
      const tbody = document.getElementById('coupons-tbody');
      if (!tbody) return;
      tbody.innerHTML = Admin.coupons.map((coupon) => `
        <tr>
          <td><code>${Admin.escape(coupon.code)}</code></td>
          <td>${Number(coupon.discount_pct)}%</td>
          <td>${Admin.date(coupon.expires_at)}</td>
          <td>${coupon.is_active ? 'Active' : 'Inactive'}</td>
          <td><button type="button" class="btn-delete" data-delete-coupon="${Admin.escape(coupon.id)}">Delete</button></td>
        </tr>`).join('') || '<tr><td colspan="5" class="table-empty">No coupons yet.</td></tr>';
      tbody.querySelectorAll('[data-delete-coupon]').forEach((button) => {
        button.addEventListener('click', () => Admin.deleteCoupon(button.dataset.deleteCoupon));
      });
    } catch (error) {
      Admin.toast(`Could not load coupons: ${error.message}`, 'error');
    }
  },

  saveCoupon: async function (event) {
    event.preventDefault();
    try {
      await API.admin.addCoupon({
        code: document.getElementById('coupon-code').value.trim().toUpperCase(),
        discount_pct: Number(document.getElementById('coupon-discount').value),
        expires_at: document.getElementById('coupon-expiry').value,
        is_active: document.getElementById('coupon-active').checked,
      });
      event.currentTarget.reset();
      document.getElementById('coupon-active').checked = true;
      document.getElementById('coupon-form-wrap')?.classList.add('hidden');
      await Admin.loadCoupons();
      Admin.toast('Coupon created.', 'success');
    } catch (error) {
      Admin.toast(`Could not create coupon: ${error.message}`, 'error');
    }
  },

  deleteCoupon: async function (id) {
    if (!window.confirm('Delete this coupon?')) return;
    try {
      await API.admin.deleteCoupon(id);
      await Admin.loadCoupons();
      Admin.toast('Coupon deleted.', 'success');
    } catch (error) {
      Admin.toast(`Could not delete coupon: ${error.message}`, 'error');
    }
  },

  loadOrders: async function () {
    try {
      Admin.orders = await API.admin.getOrders();
      const tbody = document.getElementById('orders-tbody');
      if (tbody) tbody.innerHTML = Admin.orderRows(Admin.orders);
    } catch (error) {
      Admin.toast(`Could not load orders: ${error.message}`, 'error');
    }
  },

  orderRows: function (orders) {
    return orders.map((order) => `
      <tr>
        <td>#${Admin.escape(order.id)}</td>
        <td>${Admin.escape(order.username || 'Guest')}</td>
        <td>${Admin.price(order.total)}</td>
        <td>${Admin.escape(order.status)}</td>
        <td>${Admin.date(order.created_at)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="table-empty">No orders yet.</td></tr>';
  },

  loadSettings: async function () {
    try {
      const settings = await API.getSettings();
      document.getElementById('settings-shop-name').value = settings.shop_name || '';
      document.getElementById('settings-member-discount').value = settings.member_discount_pct;
      document.getElementById('settings-accent-color').value = settings.accent_color || '#ff6b00';
      document.getElementById('settings-background-color').value = settings.background_color || '#121212';
      document.getElementById('settings-hero-heading').value = settings.hero_heading || '';
      document.getElementById('settings-hero-subtext').value = settings.hero_subtext || '';
      document.getElementById('settings-featured-title').value = settings.featured_title || '';
      document.getElementById('settings-featured-text').value = settings.featured_text || '';
      document.getElementById('settings-deal-title').value = settings.deal_title || '';
      document.getElementById('settings-deal-text').value = settings.deal_text || '';
      document.getElementById('settings-deal-button').value = settings.deal_button_text || '';
      document.getElementById('settings-name-preview').textContent = settings.shop_name || '';
      const adminBrand = document.querySelector('.admin-logo-text');
      if (adminBrand) adminBrand.textContent = settings.shop_name || 'Food Delivery';
      if (settings.logo_url) {
        const preview = document.getElementById('settings-logo-preview');
        preview.src = settings.logo_url;
        preview.style.display = 'block';
      }
      [
        ['hero_image_url', 'settings-hero-preview'],
        ['featured_image_url', 'settings-featured-preview'],
        ['deal_image_url', 'settings-deal-preview'],
      ].forEach(([urlKey, previewId]) => {
        const preview = document.getElementById(previewId);
        if (!preview) return;
        preview.classList.toggle('hidden', !settings[urlKey]);
        if (settings[urlKey]) preview.src = settings[urlKey];
      });
      document.getElementById('settings-shop-name').oninput = (event) => {
        document.getElementById('settings-name-preview').textContent = event.target.value;
      };
    } catch (error) {
      Admin.toast(`Could not load settings: ${error.message}`, 'error');
    }
  },

  saveSettings: async function (event) {
    event.preventDefault();
    try {
      const settings = await API.updateSettings({
        shop_name: document.getElementById('settings-shop-name').value.trim(),
        member_discount_pct: Number(document.getElementById('settings-member-discount').value),
        accent_color: document.getElementById('settings-accent-color').value,
        background_color: document.getElementById('settings-background-color').value,
        hero_heading: document.getElementById('settings-hero-heading').value.trim(),
        hero_subtext: document.getElementById('settings-hero-subtext').value.trim(),
        featured_title: document.getElementById('settings-featured-title').value.trim(),
        featured_text: document.getElementById('settings-featured-text').value.trim(),
        deal_title: document.getElementById('settings-deal-title').value.trim(),
        deal_text: document.getElementById('settings-deal-text').value.trim(),
        deal_button_text: document.getElementById('settings-deal-button').value.trim(),
      });
      document.getElementById('settings-name-preview').textContent =
        document.getElementById('settings-shop-name').value.trim();
      Admin.toast('Shop settings saved.', 'success');
    } catch (error) {
      Admin.toast(`Could not save settings: ${error.message}`, 'error');
    }
  },

  uploadLogo: async function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('logo', file);
    try {
      const result = await API.admin.uploadLogo(form);
      const preview = document.getElementById('settings-logo-preview');
      preview.src = `${result.logo_url}?t=${Date.now()}`;
      preview.style.display = 'block';
      Admin.toast('Shop logo updated.', 'success');
    } catch (error) {
      Admin.toast(`Could not upload logo: ${error.message}`, 'error');
    }
  },

  uploadDecoration: async function (event, kind) {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('image', file);
    try {
      await API.admin.uploadDecoration(kind, form);
      await Admin.loadSettings();
      Admin.toast(`${kind.charAt(0).toUpperCase() + kind.slice(1)} image updated.`, 'success');
    } catch (error) {
      event.target.value = '';
      Admin.toast(`Could not upload ${kind} image: ${error.message}`, 'error');
    }
  },

  setText: function (id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
  },

  escape: function (value) {
    return String(value || '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  },

  price: function (amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} MMK`;
  },

  date: function (value) {
    return value ? new Date(value).toLocaleDateString() : '—';
  },

  toast: function (message, type = 'success') {
    const container = document.getElementById('toast-container') || document.body;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
