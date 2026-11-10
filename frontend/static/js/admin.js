// Admin dashboard behavior for categories, menu items, promotions and settings.
const Admin = {
  categories: [],
  products: [],
  coupons: [],
  orders: [],
  locations: [],
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
    document.getElementById('product-is-reward')?.addEventListener('change', (event) => {
      document.getElementById('reward-points-group')?.classList.toggle('hidden', !event.target.checked);
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
    document.getElementById('password-form')?.addEventListener('submit', Admin.changePassword);
    document.getElementById('settings-logo')?.addEventListener('change', Admin.uploadLogo);
    document.getElementById('settings-hero-image')?.addEventListener('change', (event) => Admin.uploadDecoration(event, 'hero'));
    document.getElementById('settings-featured-image')?.addEventListener('change', (event) => Admin.uploadDecoration(event, 'featured'));
    document.getElementById('settings-deal-image')?.addEventListener('change', (event) => Admin.uploadDecoration(event, 'deal'));
    document.getElementById('refresh-orders-btn')?.addEventListener('click', () => Admin.loadOrders());
    document.getElementById('add-location-btn')?.addEventListener('click', () => Admin.showLocationForm());
    document.getElementById('location-cancel-btn')?.addEventListener('click', () => Admin.hideLocationForm());
    document.getElementById('location-form')?.addEventListener('submit', Admin.saveLocation);
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
      locations: Admin.loadLocations,
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
        tbody.innerHTML = '<tr><td colspan="8" class="table-empty">No products yet.</td></tr>';
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
          <td>${Number(product.loyalty_points || 0)}</td>
          <td>${product.is_reward
            ? `Yes · ${Number(product.reward_points || 0).toLocaleString('en-US')} pts`
            : '—'}</td>
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
    document.getElementById('reward-points-group')?.classList.add('hidden');
    document.getElementById('product-is-reward').checked = false;
    document.getElementById('product-reward-points').value = '';
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
    document.getElementById('product-loyalty-points').value = product.loyalty_points ?? 100;
    document.getElementById('product-is-combo').checked = product.is_combo;
    document.getElementById('product-combo-discount').value = product.combo_discount_pct;
    document.getElementById('combo-discount-group')?.classList.toggle('hidden', !product.is_combo);
    document.getElementById('product-is-reward').checked = Boolean(product.is_reward);
    document.getElementById('product-reward-points').value = product.reward_points || '';
    document.getElementById('reward-points-group')?.classList.toggle('hidden', !product.is_reward);
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
      body.append('loyalty_points', document.getElementById('product-loyalty-points').value);
      body.append('is_combo', String(document.getElementById('product-is-combo').checked));
      body.append('combo_discount_pct', document.getElementById('product-combo-discount').value || '0');
      body.append('is_reward', String(document.getElementById('product-is-reward').checked));
      body.append('reward_points', document.getElementById('product-reward-points').value || '0');
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

  loadLocations: async function () {
    try {
      Admin.locations = await API.admin.getLocations();
      const tbody = document.getElementById('locations-tbody');
      if (!tbody) return;
      tbody.innerHTML = Admin.locations.map((location) => `
        <tr>
          <td>${Admin.escape(location.name)}</td>
          <td>${Admin.escape(location.branch_no)}</td>
          <td>${Admin.escape(location.open_time)} – ${Admin.escape(location.close_time)}</td>
          <td>${location.is_open ? 'Open now' : 'Closed'}</td>
          <td class="actions-cell">
            <button type="button" class="btn-edit" data-edit-location="${Admin.escape(location.id)}">Edit</button>
            <button type="button" class="btn-delete" data-delete-location="${Admin.escape(location.id)}">Delete</button>
          </td>
        </tr>`).join('') || '<tr><td colspan="5" class="table-empty">No locations yet.</td></tr>';
      tbody.querySelectorAll('[data-edit-location]').forEach((button) => {
        button.addEventListener('click', () => Admin.editLocation(button.dataset.editLocation));
      });
      tbody.querySelectorAll('[data-delete-location]').forEach((button) => {
        button.addEventListener('click', () => Admin.deleteLocation(button.dataset.deleteLocation));
      });
    } catch (error) {
      Admin.toast(`Could not load locations: ${error.message}`, 'error');
    }
  },

  showLocationForm: function () {
    document.getElementById('location-form')?.reset();
    document.getElementById('location-id').value = '';
    document.getElementById('location-submit-btn').textContent = 'Save Location';
    document.getElementById('location-form-wrap')?.classList.remove('hidden');
  },

  editLocation: function (id) {
    const location = Admin.locations.find((item) => item.id === id);
    if (!location) return;
    document.getElementById('location-id').value = id;
    document.getElementById('location-name').value = location.name;
    document.getElementById('location-branch-no').value = location.branch_no;
    document.getElementById('location-open-time').value = location.open_time;
    document.getElementById('location-close-time').value = location.close_time;
    document.getElementById('location-submit-btn').textContent = 'Update Location';
    document.getElementById('location-form-wrap')?.classList.remove('hidden');
  },

  saveLocation: async function (event) {
    event.preventDefault();
    const button = document.getElementById('location-submit-btn');
    button.disabled = true;
    const id = document.getElementById('location-id').value;
    const data = {
      name: document.getElementById('location-name').value.trim(),
      branch_no: document.getElementById('location-branch-no').value.trim(),
      open_time: document.getElementById('location-open-time').value,
      close_time: document.getElementById('location-close-time').value,
    };
    try {
      if (id) await API.admin.updateLocation(id, data);
      else await API.admin.addLocation(data);
      Admin.hideLocationForm();
      await Admin.loadLocations();
      Admin.toast('Location saved.', 'success');
    } catch (error) {
      Admin.toast(`Could not save location: ${error.message}`, 'error');
    } finally {
      button.disabled = false;
    }
  },

  hideLocationForm: function () {
    document.getElementById('location-form-wrap')?.classList.add('hidden');
    document.getElementById('location-form')?.reset();
  },

  deleteLocation: async function (id) {
    if (!window.confirm('Delete this location?')) return;
    try {
      await API.admin.deleteLocation(id);
      await Admin.loadLocations();
      Admin.toast('Location deleted.', 'success');
    } catch (error) {
      Admin.toast(`Could not delete location: ${error.message}`, 'error');
    }
  },

  loadOrders: async function () {
    try {
      Admin.orders = await API.admin.getOrders();
      const tbody = document.getElementById('orders-tbody');
      if (tbody) {
        tbody.innerHTML = Admin.orderRows(Admin.orders, true);
        Admin.bindOrderDetails(tbody);
      }
    } catch (error) {
      Admin.toast(`Could not load orders: ${error.message}`, 'error');
    }
  },

  orderRows: function (orders, showDetails = false) {
    if (!orders.length) {
      return `<tr><td colspan="${showDetails ? 6 : 5}" class="table-empty">No orders yet.</td></tr>`;
    }
    return orders.map((order) => {
      const id = Admin.escape(order.id);
      const main = `
      <tr>
        <td>#${Admin.escape(order.id.slice(0, 8))}</td>
        <td>${Admin.escape(order.username || 'Guest')}</td>
        <td>${Admin.price(order.total)}</td>
        <td>${Admin.escape(order.status)}</td>
        <td>${Admin.date(order.created_at)}</td>
        ${showDetails ? `<td><button type="button" class="btn-secondary btn--sm" data-order-details="${id}">View</button></td>` : ''}
      </tr>`;
      if (!showDetails) return main;

      const address = order.address
        ? [
            order.address.house,
            order.address.street,
            order.address.ward,
            order.address.township,
            order.address.city,
          ].filter(Boolean).join(', ')
        : '—';
      const items = (order.items || []).map((item) => `
        <li>${Number(item.quantity)} × ${Admin.escape(item.name)}${item.special_request
          ? `<span class="order-detail-request">Request: ${Admin.escape(item.special_request)}</span>`
          : ''}</li>`).join('') || '<li>No items recorded</li>';

      return `${main}
      <tr class="order-detail-row hidden" data-order-row="${id}">
        <td colspan="6">
          <div class="order-detail-grid">
            <div>
              <h4>Deliver to</h4>
              <p>${Admin.escape(address)}</p>
              ${order.coupon_code ? `<p>Coupon: ${Admin.escape(order.coupon_code)}</p>` : ''}
            </div>
            <div>
              <h4>Items &amp; special requests</h4>
              <ul class="order-detail-items">${items}</ul>
            </div>
            <div>
              <h4>Totals</h4>
              <p>Subtotal ${Admin.price(order.subtotal)}</p>
              <p>Discount ${Admin.price(order.discount_amount)}</p>
              <p>Total ${Admin.price(order.total)}</p>
            </div>
          </div>
        </td>
      </tr>`;
    }).join('');
  },

  bindOrderDetails: function (tbody) {
    tbody.querySelectorAll('[data-order-details]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = tbody.querySelector(`[data-order-row="${button.dataset.orderDetails}"]`);
        if (!row) return;
        row.classList.toggle('hidden');
        button.textContent = row.classList.contains('hidden') ? 'View' : 'Hide';
      });
    });
  },

  loadSettings: async function () {
    try {
      const settings = await API.getSettings();
      document.getElementById('settings-shop-name').value = settings.shop_name || '';
      document.getElementById('settings-member-discount').value = settings.member_discount_pct;
      document.getElementById('settings-reward-iced-cola').value = settings.reward_iced_cola_points;
      document.getElementById('settings-reward-burger').value = settings.reward_spicy_crunch_burger_points;
      document.getElementById('settings-reward-bucket').value = settings.reward_crispy_chicken_bucket_points;
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
        reward_iced_cola_points: Number(document.getElementById('settings-reward-iced-cola').value),
        reward_spicy_crunch_burger_points: Number(document.getElementById('settings-reward-burger').value),
        reward_crispy_chicken_bucket_points: Number(document.getElementById('settings-reward-bucket').value),
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

  changePassword: async function (event) {
    event.preventDefault();
    const current = document.getElementById('password-current').value;
    const next = document.getElementById('password-new').value;
    const confirm = document.getElementById('password-confirm').value;
    const button = document.getElementById('password-submit-btn');
    if (!current || !next || !confirm) {
      Admin.toast('Please fill in every password field.', 'error');
      return;
    }
    if (next.length < 6) {
      Admin.toast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (next !== confirm) {
      Admin.toast('New password and confirmation do not match.', 'error');
      return;
    }
    if (button) button.disabled = true;
    try {
      await API.changePassword(current, next);
      document.getElementById('password-form').reset();
      Admin.toast('Admin password updated.', 'success');
    } catch (error) {
      Admin.toast(`Could not change password: ${error.message}`, 'error');
    } finally {
      if (button) button.disabled = false;
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
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },
};

document.addEventListener('DOMContentLoaded', () => Admin.init());
