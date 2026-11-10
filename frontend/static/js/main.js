// Storefront initialization and UI behavior.
const App = {
  menuData: [],
  currentCategory: '',
  currentUser: null,
  settings: {},
  lastOrderKey: 'crunchbox-last-order-v1',
  lastOrder: null,

  init: async function () {
    await Promise.all([App.loadSettings(), App.loadUser()]);
    await App.loadMenu();
    Cart.reconcileWithMenu(App.menuData);
    await LocationManager.wireDropdowns();
    App.setupEvents();
    App.restoreLastOrder();
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
    document.getElementById('see-order-btn')?.addEventListener('click', () => App.showLastOrder());
    document.getElementById('track-order-fab')?.addEventListener('click', () => App.showLastOrder());
    document.getElementById('nav-order')?.addEventListener('click', () => Cart.open());
    document.getElementById('cart-close-btn')?.addEventListener('click', () => Cart.close());
    document.getElementById('cart-clear-btn')?.addEventListener('click', () => {
      if (!Cart.items.length) return;
      if (window.confirm('Remove all items from your order?')) {
        Cart.clear();
        Cart.showToast('Order cleared.', 'info');
      }
    });
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
    document.getElementById('rewards-modal-close')?.addEventListener('click', App.closeRewardsModal);
    document.getElementById('rewards-modal-backdrop')?.addEventListener('click', App.closeRewardsModal);
    document.getElementById('login-form')?.addEventListener('submit', App.handleLogin);
    document.getElementById('register-form')?.addEventListener('submit', App.handleRegister);
    document.getElementById('order-modal-close')?.addEventListener('click', App.closeOrderModal);
    document.getElementById('order-modal-backdrop')?.addEventListener('click', App.closeOrderModal);
    window.addEventListener('beforeunload', App.confirmExit);
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') App.closeRewardsModal();
    });
  },

  updateMemberUI: function () {
    Cart.currentUser = App.currentUser;
    const note = document.getElementById('member-discount-note');
    if (note) note.classList.toggle('hidden', !App.currentUser);
    const profile = document.getElementById('nav-profile');
    if (profile) profile.setAttribute('aria-label', App.currentUser ? `Profile: ${App.currentUser.username}` : 'Login or register');
    const adminLink = document.getElementById('admin-dashboard-link');
    if (adminLink) adminLink.classList.toggle('hidden', !App.currentUser?.is_admin);
    App.updateRewardsUI();
    Cart.render();
  },

  updateRewardsUI: function () {
    const points = Math.max(0, Number(App.currentUser?.points) || 0);
    const rewardCosts = [
      Number(App.settings.reward_iced_cola_points),
      Number(App.settings.reward_spicy_crunch_burger_points),
      Number(App.settings.reward_crispy_chicken_bucket_points),
    ].filter((cost) => Number.isFinite(cost) && cost > 0);
    const nextRewardCost = rewardCosts.length ? Math.min(...rewardCosts) : 2000;
    const milestone = (Math.floor(points / nextRewardCost) + 1) * nextRewardCost;
    const progress = (points % nextRewardCost) / nextRewardCost * 100;
    const pointsElement = document.getElementById('rewards-points');
    const currentLabel = document.getElementById('rewards-current-label');
    const nextLabel = document.getElementById('rewards-next-label');
    const fill = document.getElementById('rewards-fill');
    const rewardsLink = document.getElementById('view-rewards-link');

    if (pointsElement) pointsElement.textContent = points.toLocaleString('en-US');
    if (currentLabel) currentLabel.textContent = `${points.toLocaleString('en-US')} pts`;
    if (nextLabel) nextLabel.textContent = `Next Reward: ${milestone.toLocaleString('en-US')} pts`;
    if (fill) fill.style.width = `${progress}%`;
    if (rewardsLink) {
      rewardsLink.textContent = App.currentUser ? 'View Rewards →' : 'Sign in to earn →';
      rewardsLink.onclick = App.currentUser
        ? (event) => {
            event.preventDefault();
            App.openRewardsModal();
          }
        : (event) => {
            event.preventDefault();
            App.openAuthModal('login');
          };
    }
  },

  confirmExit: function (event) {
    if (!Cart.items.length && !App.lastOrder) return;
    event.preventDefault();
    event.returnValue = '';
  },

  saveLastOrder: function (result, address) {
    App.lastOrder = {
      order: result.order,
      placedAt: Date.now(),
      address,
    };
    try {
      localStorage.setItem(App.lastOrderKey, JSON.stringify(App.lastOrder));
    } catch (error) {
      console.error('[App] Could not save recent order:', error);
    }
    App.updateSeeOrderButton();
  },

  restoreLastOrder: function () {
    try {
      const saved = JSON.parse(localStorage.getItem(App.lastOrderKey) || 'null');
      if (
        saved && saved.order && typeof saved.order.id === 'string' &&
        Number.isFinite(Number(saved.placedAt))
      ) {
        App.lastOrder = saved;
      }
    } catch (error) {
      console.error('[App] Could not restore recent order:', error);
    }
    App.updateSeeOrderButton();
  },

  updateSeeOrderButton: function () {
    const button = document.getElementById('see-order-btn');
    const fab = document.getElementById('track-order-fab');
    const fabText = fab?.querySelector('.track-order-fab-text');
    if (button) {
      button.classList.toggle('hidden', !App.lastOrder);
      if (App.lastOrder) button.textContent = `See Order #${App.lastOrder.order.id.slice(0, 6)}`;
    }
    if (fab) {
      fab.classList.toggle('hidden', !App.lastOrder);
      if (fabText && App.lastOrder) {
        fabText.textContent = `Track order #${App.lastOrder.order.id.slice(0, 6)}`;
      }
    }
  },

  showLastOrder: function () {
    if (App.lastOrder) App.openOrderModal(App.lastOrder.order, App.lastOrder);
  },

  openRewardsModal: async function () {
    const modal = document.getElementById('rewards-modal');
    const status = document.getElementById('rewards-modal-status');
    modal?.classList.remove('hidden');
    modal?.classList.add('open');
    if (status) {
      status.textContent = 'Loading rewards…';
      status.classList.remove('error');
    }

    try {
      const data = await API.getRewards();
      if (App.currentUser) {
        App.currentUser.points = data.points;
        App.updateRewardsUI();
      }
      App.renderRewards(data);
      if (status) status.textContent = '';
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add('error');
      }
    }
  },

  renderRewards: function (data) {
    const points = document.getElementById('rewards-modal-points');
    const catalog = document.getElementById('rewards-catalog');
    const activeList = document.getElementById('rewards-active-list');
    const status = document.getElementById('rewards-modal-status');
    if (!catalog || !activeList) return;
    catalog.replaceChildren();
    activeList.replaceChildren();
    if (points) points.textContent = `You have ${Number(data.points).toLocaleString('en-US')} points · Earn points with every item.`;

    (data.active_rewards || []).forEach((reward) => {
      const card = document.createElement('article');
      card.className = 'reward-voucher';
      const copy = document.createElement('div');
      const title = document.createElement('h4');
      title.textContent = reward.product.name;
      const code = document.createElement('p');
      code.className = 'reward-voucher-code';
      code.textContent = reward.code;
      const expiry = document.createElement('p');
      expiry.textContent = `Use before ${new Date(reward.expires_at).toLocaleDateString()}`;
      copy.append(title, code, expiry);
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'btn-secondary';
      use.textContent = 'Use reward';
      use.addEventListener('click', () => App.applyRewardVoucher(reward));
      card.append(copy, use);
      activeList.appendChild(card);
    });
    if (!data.active_rewards?.length) {
      const empty = document.createElement('p');
      empty.className = 'rewards-modal-status';
      empty.textContent = 'No unused reward vouchers yet.';
      activeList.appendChild(empty);
    }

    (data.catalog || []).forEach((reward) => {
      const card = document.createElement('article');
      card.className = 'reward-card';
      const copy = document.createElement('div');
      copy.className = 'reward-card-copy';
      const title = document.createElement('h4');
      title.textContent = reward.product.name;
      const description = document.createElement('p');
      description.textContent = `${Cart.formatPrice(reward.product.price)} · ${Number(reward.points_cost).toLocaleString('en-US')} points`;
      description.className = 'reward-card-cost';
      copy.append(title, description);
      const redeem = document.createElement('button');
      redeem.type = 'button';
      redeem.className = 'btn-primary';
      redeem.textContent = 'Redeem';
      redeem.disabled = Number(data.points) < Number(reward.points_cost);
      redeem.addEventListener('click', () => App.redeemReward(reward.id, redeem));
      card.append(copy, redeem);
      catalog.appendChild(card);
    });
    if (!data.catalog?.length && status) {
      status.textContent = 'There are no rewards available right now.';
    }
  },

  redeemReward: async function (rewardId, button) {
    const status = document.getElementById('rewards-modal-status');
    button.disabled = true;
    try {
      const result = await API.redeemReward(rewardId);
      if (App.currentUser) {
        App.currentUser.points = result.points;
        App.updateRewardsUI();
      }
      Cart.showToast(`Reward redeemed! ${result.reward.code} is ready to use.`, 'success');
      await App.openRewardsModal();
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add('error');
      }
      button.disabled = false;
    }
  },

  applyRewardVoucher: async function (reward) {
    const status = document.getElementById('rewards-modal-status');
    try {
      const result = await API.validateCoupon(reward.code);
      if (!result.valid) throw new Error(result.reason || 'This reward voucher is not valid.');
      if (!Cart.items.some((item) => item.product_id === String(reward.product.id))) {
        Cart.addItem(reward.product);
      }
      Cart.appliedCoupon = {
        code: result.code,
        discount_pct: Number(result.discount_pct),
        reward_product_id: result.reward_product_id || '',
      };
      Cart.render();
      const couponInput = document.getElementById('coupon-input');
      if (couponInput) couponInput.value = result.code;
      Cart.saveState();
      App.closeRewardsModal();
      Cart.open();
      Cart.showToast(`Added ${reward.product.name} and applied your reward voucher.`, 'success');
    } catch (error) {
      if (status) {
        status.textContent = error.message;
        status.classList.add('error');
      }
    }
  },

  closeRewardsModal: function () {
    const modal = document.getElementById('rewards-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('open');
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

  openOrderModal: function (order, savedOrder = App.lastOrder) {
    const modal = document.getElementById('order-modal');
    modal?.classList.remove('hidden');
    modal?.classList.add('open');
    const id = document.getElementById('order-modal-id');
    if (id && order) id.textContent = `#${order.id}`;
    const receipt = document.getElementById('order-receipt-items');
    if (receipt) {
      receipt.replaceChildren();
      (order?.items || []).forEach((item) => {
        const row = document.createElement('p');
        row.textContent = `${item.quantity} × ${item.name}`;
        receipt.appendChild(row);
        if (item.special_request) {
          const request = document.createElement('small');
          request.textContent = `Request: ${item.special_request}`;
          receipt.appendChild(request);
        }
      });
    }
    const requestSummary = document.getElementById('order-special-request');
    if (requestSummary) {
      const address = savedOrder?.address;
      requestSummary.textContent = address
        ? `Delivering to: ${[address.house, address.street, address.ward, address.township, address.city].filter(Boolean).join(', ')}`
        : '';
      requestSummary.classList.toggle('hidden', !address);
    }
    Tracker.startStages({
      stagePrefix: 'stage-',
      supportId: 'order-support-box',
      totalStages: 5,
      startedAt: savedOrder?.placedAt || Date.now(),
    });
  },

  closeOrderModal: function () {
    const modal = document.getElementById('order-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('open');
  },

  escapeHTML: function (value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
