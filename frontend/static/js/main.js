// Storefront initialization and UI behavior.
const App = {
  menuData: [],
  currentCategory: '',
  currentUser: null,
  settings: {},

  init: async function () {
    await Promise.all([App.loadSettings(), App.loadUser()]);
    await App.loadMenu();
    await LocationManager.wireDropdowns();
    App.setupEvents();
    Cart.render();
    Cart.updateBadge();
  },

  loadSettings: async function () {
    try {
      const settings = await API.getSettings();
      App.settings = settings;
      Cart.memberDiscountPct = Number(settings.member_discount_pct ?? 10);
      App.applyStorefrontSettings(settings);
      const name = document.getElementById('shop-name');
      if (name) name.textContent = settings.shop_name || 'Food Delivery';
      document.title = `${settings.shop_name || 'Food Delivery'} — Fresh food, delivered`;
      const memberNote = document.getElementById('member-discount-note');
      if (memberNote) memberNote.textContent = `🏷️ ${Number(settings.member_discount_pct)}% member discount applied!`;
      const memberLabel = document.querySelector('#member-discount-row span');
      if (memberLabel) memberLabel.textContent = `Member Discount (${Number(settings.member_discount_pct)}%)`;
      const logo = document.getElementById('shop-logo');
      if (logo && settings.logo_url) {
        logo.src = `${settings.logo_url}?t=${Date.now()}`;
        logo.style.display = 'block';
      }
    } catch (error) {
      console.error('[App] Failed to load shop settings:', error);
    }
  },

  applyStorefrontSettings: function (settings) {
    const root = document.documentElement;
    if (settings.accent_color) {
      root.style.setProperty('--orange', settings.accent_color);
      root.style.setProperty('--orange-hover', App.adjustColor(settings.accent_color, -20));
      root.style.setProperty('--orange-light', App.adjustColor(settings.accent_color, 18));
      root.style.setProperty('--orange-glow', `${settings.accent_color}59`);
    }
    if (settings.background_color) root.style.setProperty('--bg', settings.background_color);

    const hero = document.getElementById('hero');
    const heroHeading = document.getElementById('hero-heading');
    const heroSubtext = document.getElementById('hero-subtext');
    if (heroHeading && settings.hero_heading) heroHeading.textContent = settings.hero_heading;
    if (heroSubtext && settings.hero_subtext) heroSubtext.textContent = settings.hero_subtext;
    if (hero) {
      const image = settings.hero_image_url;
      hero.style.backgroundImage = image
        ? `linear-gradient(90deg, rgba(14, 10, 7, .93) 0%, rgba(14, 10, 7, .74) 42%, rgba(14, 10, 7, .18) 100%), url("${image}")`
        : 'radial-gradient(ellipse at 78% 50%, rgba(255,107,0,.24), transparent 34%), linear-gradient(110deg, #180d07 0%, #301507 56%, #121212 100%)';
      hero.classList.toggle('has-hero-photo', Boolean(image));
    }

    App.setText('featured-promo-title', settings.featured_title);
    App.setText('featured-promo-text', settings.featured_text);
    App.setText('deal-promo-title', settings.deal_title);
    App.setText('deal-promo-text', settings.deal_text);
    App.setText('deal-promo-button', settings.deal_button_text);
    App.applyPromoImage('featured-promo-card', settings.featured_image_url, 'dark');
    App.applyPromoImage('deal-promo-card', settings.deal_image_url, 'orange');
  },

  applyPromoImage: function (elementId, image, variant) {
    const element = document.getElementById(elementId);
    if (!element) return;
    element.classList.toggle('has-promo-photo', Boolean(image));
    element.style.backgroundImage = image
      ? `url("${image}")`
      : variant === 'orange'
        ? ''
        : '';
  },

  setText: function (id, value) {
    const element = document.getElementById(id);
    if (element && value) element.textContent = value;
  },

  adjustColor: function (hex, amount) {
    const value = Number.parseInt(hex.slice(1), 16);
    const channel = (shift) => Math.max(0, Math.min(255, ((value >> shift) & 255) + amount));
    return `#${[16, 8, 0].map((shift) => channel(shift).toString(16).padStart(2, '0')).join('')}`;
  },

  loadUser: async function () {
    try {
      const response = await API.getMe();
      App.currentUser = response.logged_in ? response.user : null;
    } catch (error) {
      console.error('[App] Failed to load session:', error);
      App.currentUser = null;
    }
    Cart.currentUser = App.currentUser;
    App.updateMemberUI();
  },

  loadMenu: async function () {
    const grid = document.getElementById('menu-grid');
    try {
      App.menuData = await API.getMenu();
      App.renderCategoryTabs();
      if (App.menuData.length) App.onTabClick(App.menuData[0].id);
      else if (grid) grid.textContent = 'There are no menu categories yet.';
    } catch (error) {
      console.error('[App] Failed to load menu:', error);
      if (grid) grid.textContent = 'Could not load the menu. Please refresh the page.';
    }
  },

  renderCategoryTabs: function () {
    const tabs = document.getElementById('category-tabs');
    if (!tabs) return;
    tabs.replaceChildren();
    App.menuData.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab-btn';
      button.dataset.categoryId = category.id;
      button.innerHTML = `<span class="tab-icon">${App.escapeHTML(category.icon || '')}</span><span class="tab-label">${App.escapeHTML(category.name)}</span>`;
      button.addEventListener('click', () => App.onTabClick(category.id));
      tabs.appendChild(button);
    });
  },

  onTabClick: function (categoryId) {
    App.currentCategory = String(categoryId);
    const category = App.menuData.find((item) => item.id === App.currentCategory);
    if (!category) return;
    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.categoryId === App.currentCategory);
    });
    const title = document.querySelector('#menu-section .section-title');
    const count = document.getElementById('menu-count-label');
    if (title) title.textContent = `${category.icon || ''} ${category.name}`;
    if (count) count.textContent = `${category.products.length} items`;
    App.renderProducts(category.products);
  },

  renderProducts: function (products) {
    const grid = document.getElementById('menu-grid');
    const noResults = document.getElementById('no-results');
    if (!grid) return;
    grid.replaceChildren();
    if (noResults) noResults.classList.toggle('hidden', products.length > 0);
    products.forEach((product) => grid.appendChild(App.createProductCard(product)));
  },

  createProductCard: function (product) {
    const card = document.createElement('article');
    card.className = 'menu-card';
    const imageMarkup = product.image_url
      ? `<img src="${App.escapeHTML(product.image_url)}" alt="${App.escapeHTML(product.name)}" class="menu-card-img" loading="lazy">`
      : '<div class="menu-card-img menu-card-placeholder" aria-hidden="true">🍗</div>';
    card.innerHTML = `
      <div class="menu-card-img-wrap">${imageMarkup}
        ${product.is_combo ? `<span class="menu-card-combo-label">🎁 Combo −${Number(product.combo_discount_pct)}%</span>` : ''}
      </div>
      <div class="menu-card-body">
        <h3 class="menu-card-name">${App.escapeHTML(product.name)}</h3>
        <p class="menu-card-desc">${App.escapeHTML(product.description || '')}</p>
        <div class="menu-card-footer">
          <span class="menu-card-price">${Cart.formatPrice(product.price)}</span>
          <button class="add-to-cart-btn" type="button" aria-label="Add ${App.escapeHTML(product.name)} to cart">+</button>
        </div>
      </div>`;
    card.querySelector('.add-to-cart-btn').addEventListener('click', () => {
      Cart.addItem(product);
      Cart.showToast('Added to your order.', 'success');
    });
    const image = card.querySelector('img');
    if (image) image.addEventListener('error', () => {
      image.replaceWith(Object.assign(document.createElement('div'), {
        className: 'menu-card-img menu-card-placeholder',
        textContent: '🍗',
      }));
    });
    return card;
  },

  setupEvents: function () {
    document.getElementById('cart-btn')?.addEventListener('click', () => Cart.open());
    document.getElementById('nav-order')?.addEventListener('click', () => Cart.open());
    document.getElementById('cart-close-btn')?.addEventListener('click', () => Cart.close());
    document.getElementById('cart-overlay')?.addEventListener('click', () => Cart.close());
    document.getElementById('checkout-btn')?.addEventListener('click', () => Cart.handleCheckout());
    document.getElementById('coupon-apply-btn')?.addEventListener('click', () => Cart.handleCouponApply());
    document.getElementById('nav-home')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.getElementById('nav-menu')?.addEventListener('click', () => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' }));
    document.getElementById('nav-deals')?.addEventListener('click', () => document.querySelector('.promo-section')?.scrollIntoView({ behavior: 'smooth' }));
    document.getElementById('order-now-btn')?.addEventListener('click', () => document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' }));
    document.getElementById('deal-promo-button')?.addEventListener('click', () => {
      document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('search-input')?.addEventListener('input', async (event) => {
      const query = event.target.value.trim();
      if (!query) {
        if (App.currentCategory) App.onTabClick(App.currentCategory);
        return;
      }
      try {
        const matches = await API.searchProducts(query);
        App.renderProducts(matches);
        const title = document.querySelector('#menu-section .section-title');
        if (title) title.textContent = `Search results for "${query}"`;
      } catch (error) {
        console.error('[App] Search failed:', error);
      }
    });

    document.getElementById('nav-profile')?.addEventListener('click', () => {
      if (!App.currentUser) {
        App.openAuthModal('login');
        return;
      }
      if (App.currentUser.is_admin) {
        window.location.href = '/admin';
        return;
      }
      const shouldLogout = window.confirm(`Signed in as ${App.currentUser.username}. Log out?`);
      if (shouldLogout) App.handleLogout();
    });

    document.getElementById('login-tab')?.addEventListener('click', () => App.openAuthModal('login'));
    document.getElementById('register-tab')?.addEventListener('click', () => App.openAuthModal('register'));
    document.querySelectorAll('.auth-switch-link').forEach((button) => {
      button.addEventListener('click', () => App.openAuthModal(button.dataset.tab));
    });
    document.getElementById('auth-modal-close-x')?.addEventListener('click', App.closeAuthModal);
    document.getElementById('auth-modal-backdrop')?.addEventListener('click', App.closeAuthModal);
    document.getElementById('login-form')?.addEventListener('submit', App.handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', App.handleRegister);
    document.getElementById('order-modal-close')?.addEventListener('click', App.closeOrderModal);
    document.getElementById('order-modal-backdrop')?.addEventListener('click', App.closeOrderModal);
  },

  updateMemberUI: function () {
    Cart.currentUser = App.currentUser;
    const note = document.getElementById('member-discount-note');
    if (note) note.classList.toggle('hidden', !App.currentUser);
    const profile = document.getElementById('nav-profile');
    if (profile) profile.setAttribute('aria-label', App.currentUser ? `Profile: ${App.currentUser.username}` : 'Login or register');
    const adminLink = document.getElementById('admin-dashboard-link');
    if (adminLink) adminLink.classList.toggle('hidden', !App.currentUser?.is_admin);
    Cart.render();
  },

  openAuthModal: function (tab) {
    const modal = document.getElementById('auth-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('open');
    const login = tab === 'login';
    document.getElementById('login-form')?.classList.toggle('hidden', !login);
    document.getElementById('register-form')?.classList.toggle('hidden', login);
    document.getElementById('login-tab')?.classList.toggle('active', login);
    document.getElementById('register-tab')?.classList.toggle('active', !login);
  },

  closeAuthModal: function () {
    const modal = document.getElementById('auth-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('open');
  },

  handleLogin: async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const response = await API.login(
        document.getElementById('login-email').value.trim(),
        document.getElementById('login-password').value
      );
      App.currentUser = response.user;
      App.updateMemberUI();
      App.closeAuthModal();
      Cart.showToast(`Welcome back, ${App.currentUser.username}!`, 'success');
    } catch (error) {
      Cart.showToast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  },

  handleRegister: async function (event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const response = await API.register(
        document.getElementById('reg-username').value.trim(),
        document.getElementById('reg-email').value.trim(),
        document.getElementById('reg-password').value
      );
      const login = await API.login(
        document.getElementById('reg-email').value.trim(),
        document.getElementById('reg-password').value
      );
      App.currentUser = login.user || response.user;
      App.updateMemberUI();
      App.closeAuthModal();
      Cart.showToast('Account created. Please log in to receive member pricing.', 'success');
    } catch (error) {
      Cart.showToast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  },

  handleLogout: async function () {
    try {
      await API.logout();
      App.currentUser = null;
      App.updateMemberUI();
      Cart.appliedCoupon = null;
      Cart.showToast('You have been logged out.', 'info');
    } catch (error) {
      Cart.showToast(`Could not log out: ${error.message}`, 'error');
    }
  },

  openOrderModal: function (result) {
    const modal = document.getElementById('order-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('open');
    const id = document.getElementById('order-modal-id');
    if (id && result.order) id.textContent = `#${result.order.id}`;
    Tracker.startStages({ stagePrefix: 'stage-', supportId: 'order-support-box', totalStages: 5 });
  },

  closeOrderModal: function () {
    const modal = document.getElementById('order-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('open');
    Tracker.reset();
  },

  escapeHTML: function (value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
