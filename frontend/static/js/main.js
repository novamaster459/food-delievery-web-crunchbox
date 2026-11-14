// Storefront initialization and UI behavior.
const App = {
  menuData: [],
  currentCategory: '',
  currentUser: null,
  settings: {},
  lastOrderKey: 'crunchbox-last-order-v1',
  lastOrder: null,
  branchLocations: [],
  storeOpen: true,
  orderHistory: [],
  playlistTimers: {},
  categoryIconMap: {
    'Mains': '/static/images/icons/icon-main.png',
    'Vegan Main Meal': '/static/images/icons/icon-vegan.png',
    'Drinks': '/static/images/icons/icon-drinks.png',
    'Appetizers': '/static/images/icons/icon-appetizer.png',
    'Desserts': '/static/images/icons/icon-dessert.png',
    'Special Combo Sets': '/static/images/icons/icon-combo.png',
  },

  init: async function () {
    await Promise.all([App.loadSettings(), App.loadUser(), App.loadBranchLocations(), App.loadOrderHistory()]);
    await App.loadMenu();
    Cart.reconcileWithMenu(App.menuData);
    await LocationManager.wireDropdowns();
    App.setupEvents();
    App.restoreLastOrder();
    Cart.render();
    Cart.updateBadge();
    setInterval(() => App.loadBranchLocations(), 60 * 1000);
  },

  loadBranchLocations: async function () {
    try {
      App.branchLocations = await API.getBranchLocations();
    } catch (error) {
      console.error('[App] Failed to load branch locations:', error);
      App.branchLocations = [];
    }
    App.renderBranchLocations();
  },

  renderBranchLocations: function () {
    const grid = document.getElementById('store-locations-grid');
    const empty = document.getElementById('store-locations-empty');
    const count = document.getElementById('locations-count-label');
    const locations = App.branchLocations;

    const anyOpen = locations.some((loc) => loc.is_open);
    App.storeOpen = !locations.length || anyOpen;

    if (count) count.textContent = locations.length ? `${locations.length} branch${locations.length > 1 ? 'es' : ''}` : '';
    if (empty) empty.classList.toggle('hidden', locations.length > 0);
    if (!grid) {
      App.applyStoreOpenState();
      return;
    }
    grid.replaceChildren();
    locations.forEach((location) => {
      const card = document.createElement('article');
      card.className = 'branch-card';
      const status = location.is_open
        ? '<span class="branch-status branch-status--open">Open now</span>'
        : '<span class="branch-status branch-status--closed">Closed</span>';
      card.innerHTML = `
        <div class="branch-card-head">
          <svg class="branch-card-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          <h3 class="branch-card-name">${App.escapeHTML(location.name)}</h3>
          ${status}
        </div>
        <p class="branch-card-meta">Branch No. ${App.escapeHTML(location.branch_no)}</p>
        ${location.address ? `<p class="branch-card-address">${App.escapeHTML(location.address)}</p>` : ''}
        <p class="branch-card-hours">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
          ${App.escapeHTML(location.open_label || location.open_time)} – ${App.escapeHTML(location.close_label || location.close_time)}
        </p>`;
      grid.appendChild(card);
    });
    App.applyStoreOpenState();
  },

  applyStoreOpenState: function () {
    const note = document.getElementById('closed-ordering-note');
    const opensAt = document.getElementById('closed-opens-at');
    const closed = App.branchLocations.length > 0 && !App.storeOpen;
    if (note) {
      note.classList.toggle('hidden', !closed);
      if (closed && opensAt) {
        opensAt.textContent = [
          ...new Map(App.branchLocations.map((loc) => [loc.open_time, loc.open_label || loc.open_time])).entries(),
        ]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([, label]) => label)
          .join(' / ');
      }
    }
    Cart.render();
  },

  closedMessage: function () {
    const labels = [
      ...new Map(App.branchLocations.map((loc) => [loc.open_time, loc.open_label || loc.open_time])).entries(),
    ]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, label]) => label)
      .join(' / ');
    return labels
      ? `All branches are closed right now. You can browse the menu and rewards, but ordering opens at ${labels} (Myanmar time).`
      : 'All branches are closed right now. Ordering opens during opening hours.';
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
      if (memberNote) memberNote.textContent = `${Number(settings.member_discount_pct)}% member discount applied!`;
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
    const heroLogo = document.getElementById('hero-logo');
    const heroLogoWrap = document.getElementById('hero-logo-wrap');
    if (heroHeading && settings.hero_heading) heroHeading.textContent = settings.hero_heading;
    if (heroSubtext && settings.hero_subtext) heroSubtext.textContent = settings.hero_subtext;
    if (heroLogo && settings.logo_url) {
      heroLogo.src = settings.logo_url;
      heroLogoWrap?.classList.remove('hidden');
    } else if (heroLogoWrap) {
      heroLogoWrap.classList.add('hidden');
    }
    if (hero) {
      const image = settings.hero_image_url;
      hero.style.backgroundImage = image
        ? `linear-gradient(90deg, rgba(10, 5, 5, .95) 0%, rgba(10, 5, 5, .78) 42%, rgba(10, 5, 5, .18) 100%), url("${image}")`
        : 'radial-gradient(ellipse at 78% 50%, rgba(255,94,0,.24), transparent 34%), linear-gradient(135deg, #0a0a0a 0%, #1a0505 35%, #2a1000 65%, #0f0f0f 100%)';
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
    element.style.backgroundImage = image ? `url("${image}")` : '';
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

  loadOrderHistory: async function () {
    try {
      App.orderHistory = await API.getOrderHistory();
    } catch (error) {
      App.orderHistory = [];
    }
  },

  loadMenu: async function () {
    const grid = document.getElementById('menu-grid');
    try {
      App.menuData = await API.getMenu();
      App.renderRecommendedSection();
      App.renderCategoryTabs();
      if (App.menuData.length) {
        const firstRegular = App.menuData[0].id;
        App.onTabClick(firstRegular);
      } else if (grid) {
        grid.textContent = 'There are no menu categories yet.';
      }
    } catch (error) {
      console.error('[App] Failed to load menu:', error);
      if (grid) grid.textContent = 'Could not load the menu. Please refresh the page.';
    }
  },

  allProducts: function () {
    const list = [];
    App.menuData.forEach((cat) => {
      cat.products.forEach((p) => list.push({ ...p, categoryName: cat.name, categoryIcon: cat.icon }));
    });
    return list;
  },

  renderCategoryTabs: function () {
    const tabs = document.getElementById('category-tabs');
    if (!tabs) return;
    tabs.replaceChildren();

    App.menuData.forEach((category) => {
      const icon = App.categoryIconMap[category.name] || category.icon || '/static/images/icons/icon-main.png';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'tab-btn';
      button.dataset.categoryId = category.id;
      button.innerHTML = `
        <img src="${App.escapeHTML(icon)}" alt="" class="tab-icon" />
        <span class="tab-label">${App.escapeHTML(category.name)}</span>
      `;
      button.addEventListener('click', () => App.onTabClick(category.id));
      tabs.appendChild(button);
    });
  },

  renderRecommendedSection: function () {
    const section = document.getElementById('recommended-section');
    const grid = document.getElementById('recommended-grid');
    if (!section || !grid) return;

    const counts = {};
    App.orderHistory.forEach((order) => {
      (order.items || []).forEach((item) => {
        const pid = item.product_id || item.id;
        counts[pid] = (counts[pid] || 0) + Number(item.quantity || 1);
      });
    });

    const products = App.allProducts();
    let recommended = [];
    if (Object.keys(counts).length) {
      const sortedPids = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([pid]) => pid);
      recommended = sortedPids
        .map((pid) => products.find((p) => p.id === pid))
        .filter(Boolean)
        .slice(0, 6);
    } else {
      // Fallback: bestsellers from each category
      recommended = App.menuData
        .map((cat) => cat.products.find((p) => p.is_bestseller))
        .filter(Boolean)
        .slice(0, 6);
      if (!recommended.length) recommended = products.slice(0, 6);
    }

    section.classList.toggle('hidden', !recommended.length);
    grid.replaceChildren();
    recommended.forEach((p) => grid.appendChild(App.createProductCard(p)));
  },

  onTabClick: function (categoryId) {
    App.currentCategory = String(categoryId);

    document.querySelectorAll('.tab-btn').forEach((button) => {
      button.classList.toggle('active', button.dataset.categoryId === App.currentCategory);
    });

    // Always show recommended section above tabs
    document.getElementById('recommended-section')?.classList.remove('hidden');

    const menuSection = document.getElementById('menu-section');
    const title = menuSection?.querySelector('.section-title');
    const count = document.getElementById('menu-count-label');
    const grid = document.getElementById('menu-grid');
    const noResults = document.getElementById('no-results');

    if (menuSection) menuSection.classList.remove('hidden');
    const category = App.menuData.find((item) => item.id === App.currentCategory);
    if (!category) return;

    // Set section title with icon + category name
    const iconSrc = App.categoryIconMap[category.name] || category.icon || '/static/images/icons/icon-main.png';
    if (title) title.innerHTML = `<img src="${App.escapeHTML(iconSrc)}" alt="" /> ${App.escapeHTML(category.name)}`;
    if (count) count.textContent = `${category.products.length} items`;

    // Render playlists (sub-tab slideshows) above the product grid
    App.renderPlaylists(category);

    // Render product grid (bestseller is already first in the array from backend)
    App.renderProducts(category.products);
    menuSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },

  renderPlaylists: function (category) {
    const container = document.getElementById('playlists-container');
    if (!container) return;
    Object.values(App.playlistTimers).forEach((timer) => clearInterval(timer));
    App.playlistTimers = {};
    container.replaceChildren();

    const playlists = (category.playlists || []).filter((pl) => pl.items && pl.items.length);
    if (!playlists.length) return;

    // Each playlist is one section: a single product slot on the left that
    // keeps auto-sliding (with animation) through its items every 5s.
    const wrap = document.createElement('div');
    wrap.className = 'playlist-subtabs';

    playlists.forEach((playlist) => {
      const block = document.createElement('section');
      block.className = 'playlist-block';

      const header = document.createElement('div');
      header.className = 'playlist-block-header';
      header.innerHTML =
        '<span class="playlist-block-title">' + App.escapeHTML(playlist.name) + '</span>' +
        '<div class="playlist-block-controls">' +
          '<span class="playlist-counter"></span>' +
          '<button type="button" class="playlist-more-btn">See all ' +
            '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>' +
          '</button>' +
        '</div>';

      const stage = document.createElement('div');
      stage.className = 'playlist-stage';

      // track of all playlist cards; we slide it left one card at a time
      const track = document.createElement('div');
      track.className = 'playlist-track';
      playlist.items.forEach((item) => {
        track.appendChild(App.createProductCard(item));
      });
      stage.appendChild(track);

      block.appendChild(header);
      block.appendChild(stage);
      wrap.appendChild(block);

      const counter = header.querySelector('.playlist-counter');
      const state = { pos: 0 };

      const goTo = (next) => {
        state.pos = (next + playlist.items.length) % playlist.items.length;
        const card = track.querySelector('.menu-card');
        const step = card ? card.getBoundingClientRect().width + 14 : 234; // card width + gap
        track.style.transform = 'translateX(-' + (state.pos * step) + 'px)';
        counter.textContent = (state.pos + 1) + ' / ' + playlist.items.length;
      };

      const startAuto = () => {
        Object.values(App.playlistTimers).forEach((timer) => clearInterval(timer));
        App.playlistTimers = {};
        App.playlistTimers[playlist.id] = setInterval(() => goTo(state.pos + 1), 5000);
      };

      header.querySelector('.playlist-more-btn').addEventListener('click', () => App.openPlaylistModal(playlist));

      block.addEventListener('mouseenter', () => {
        Object.values(App.playlistTimers).forEach((timer) => clearInterval(timer));
      });
      block.addEventListener('mouseleave', startAuto);

      goTo(0);
      startAuto();
    });

    container.appendChild(wrap);
  },

  openPlaylistModal: function (playlist) {
    const modal = document.getElementById('playlist-modal');
    if (!modal) return;
    document.getElementById('playlist-modal-title').textContent = playlist.name;
    document.getElementById('playlist-modal-subtitle').textContent =
      playlist.items.length + ' item' + (playlist.items.length === 1 ? '' : 's') + ' in this playlist';
    const grid = document.getElementById('playlist-modal-grid');
    grid.replaceChildren();
    playlist.items.forEach((item) => grid.appendChild(App.createProductCard(item)));
    modal.classList.remove('hidden');
    modal.classList.add('open');
  },

  closePlaylistModal: function () {
    const modal = document.getElementById('playlist-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('open');
  },

  showPlaylistSlide: function (slideshow, slides, index, dotsContainer) {
    slides.forEach((slide, i) => {
      slide.style.display = i === index ? 'flex' : 'none';
      if (i === index) {
        slide.classList.remove('slide-enter');
        void slide.offsetWidth; // force reflow
        slide.classList.add('slide-enter');
      }
    });
    if (dotsContainer) {
      dotsContainer.querySelectorAll('.playlist-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === index);
      });
    }
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
    if (product.is_bestseller) card.classList.add('menu-card--bestseller');

    const imageMarkup = product.image_url
      ? `<img src="${App.escapeHTML(product.image_url)}" alt="${App.escapeHTML(product.name)}" class="menu-card-img" loading="lazy">`
      : `<div class="menu-card-img menu-card-placeholder" aria-hidden="true"><img src="/static/images/icons/icon-main.png" alt="" /></div>`;

    // New bestseller indicator: flame icon badge overlay on the image
    const bestsellerBadge = product.is_bestseller
      ? `<div class="bestseller-flame" title="Bestseller">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.46 7.93 4 10.78 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.06-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z"/>
          </svg>
          <span>Top Pick</span>
        </div>`
      : '';

    card.innerHTML = `
      <div class="menu-card-img-wrap">
        ${bestsellerBadge}
        ${imageMarkup}
        ${product.is_combo ? `<span class="menu-card-combo-label">Combo -${Number(product.combo_discount_pct)}%</span>` : ''}
      </div>
      <div class="menu-card-body">
        <div class="menu-card-badges">
          ${product.is_new ? '<span class="menu-badge menu-badge--new">New</span>' : ''}
        </div>
        <h3 class="menu-card-name">${App.escapeHTML(product.name)}</h3>
        <p class="menu-card-desc">${App.escapeHTML(product.description || '')}</p>
        <div class="menu-card-footer">
          <span class="menu-card-price">${Cart.formatPrice(product.price)}</span>
          <button class="add-to-cart-btn" type="button" aria-label="Add ${App.escapeHTML(product.name)} to cart">+</button>
        </div>
      </div>`;

    card.addEventListener('click', (event) => {
      if (event.target.closest('.add-to-cart-btn')) return;
      App.openProductModal(product);
    });

    card.querySelector('.add-to-cart-btn').addEventListener('click', (event) => {
      event.stopPropagation();
      if (!App.storeOpen) {
        App.showAlert(App.closedMessage());
        return;
      }
      Cart.addItem(product);
      Cart.showToast('Added to your order.', 'success');
    });

    const image = card.querySelector('img.menu-card-img');
    if (image) {
      image.addEventListener('error', () => {
        image.replaceWith(Object.assign(document.createElement('div'), {
          className: 'menu-card-img menu-card-placeholder',
          innerHTML: '<img src="/static/images/icons/icon-main.png" alt="" />',
        }));
      });
    }
    return card;
  },

  openProductModal: function (product) {
    const modal = document.getElementById('product-modal');
    const img = document.getElementById('product-modal-img');
    const name = document.getElementById('product-modal-name');
    const desc = document.getElementById('product-modal-desc');
    const price = document.getElementById('product-modal-price');
    const points = document.getElementById('product-modal-points');
    const badges = document.getElementById('product-modal-badges');
    const addBtn = document.getElementById('product-modal-add');

    if (img) img.src = product.image_url || '/static/images/icons/icon-main.png';
    if (img) img.alt = product.name;
    if (name) name.textContent = product.name;
    if (desc) desc.textContent = product.description || '';
    if (price) price.innerHTML = `${Cart.formatPrice(product.price)}`;
    if (points) points.textContent = `+${product.loyalty_points || 100} pts`;

    if (badges) {
      badges.replaceChildren();
      if (product.is_bestseller) badges.insertAdjacentHTML('beforeend', '<span class="menu-badge menu-badge--bestseller">Top Pick</span>');
      if (product.is_new) badges.insertAdjacentHTML('beforeend', '<span class="menu-badge menu-badge--new">New</span>');
      if (product.is_combo) badges.insertAdjacentHTML('beforeend', `<span class="menu-badge menu-badge--bestseller">Combo -${Number(product.combo_discount_pct)}%</span>`);
    }

    addBtn.onclick = () => {
      if (!App.storeOpen) {
        App.showAlert(App.closedMessage());
        return;
      }
      Cart.addItem(product);
      Cart.showToast('Added to your order.', 'success');
      App.closeProductModal();
    };

    modal?.classList.remove('hidden');
    modal?.classList.add('open');
  },

  closeProductModal: function () {
    const modal = document.getElementById('product-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('open');
  },

  setupEvents: function () {
    document.getElementById('cart-btn')?.addEventListener('click', () => Cart.open());
    document.getElementById('track-order-fab')?.addEventListener('click', () => App.showLastOrder());
    document.getElementById('alert-modal-ok')?.addEventListener('click', () => App.hideAlert());
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

    document.getElementById('product-modal-backdrop')?.addEventListener('click', App.closeProductModal);
    document.getElementById('playlist-modal-backdrop')?.addEventListener('click', App.closePlaylistModal);
    document.getElementById('playlist-modal-close-x')?.addEventListener('click', App.closePlaylistModal);
    document.getElementById('product-modal-close-x')?.addEventListener('click', App.closeProductModal);
    document.getElementById('profile-modal-backdrop')?.addEventListener('click', App.closeProfileModal);
    document.getElementById('profile-modal-close-x')?.addEventListener('click', App.closeProfileModal);
    document.getElementById('profile-logout-btn')?.addEventListener('click', App.handleLogout);

    const setActiveNav = (id) => {
      document.querySelectorAll('.bottom-nav-item').forEach((item) => {
        item.classList.toggle('active', item.id === id);
      });
    };

    document.getElementById('nav-home')?.addEventListener('click', () => {
      setActiveNav('nav-home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    document.getElementById('nav-menu')?.addEventListener('click', () => {
      setActiveNav('nav-menu');
      document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('nav-deals')?.addEventListener('click', () => {
      setActiveNav('nav-deals');
      document.querySelector('.promo-section')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('nav-locations')?.addEventListener('click', () => {
      setActiveNav('nav-locations');
      window.location.href = '/locations';
    });
    document.getElementById('nav-luck')?.addEventListener('click', () => {
      window.location.href = '/luck';
    });
    document.getElementById('nav-profile')?.addEventListener('click', () => {
      setActiveNav('nav-profile');
      if (!App.currentUser) {
        App.openAuthModal('login');
        return;
      }
      App.openProfileModal();
    });

    document.getElementById('order-now-btn')?.addEventListener('click', () => {
      document.getElementById('menu-section')?.scrollIntoView({ behavior: 'smooth' });
    });
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
      if (event.key === 'Escape') {
        App.closeRewardsModal();
        App.closeProductModal();
        App.closeProfileModal();
      }
    });
  },

  openProfileModal: function () {
    const modal = document.getElementById('profile-modal');
    const username = document.getElementById('profile-username');
    const email = document.getElementById('profile-email');
    const stats = document.getElementById('profile-stats');
    const adminBtn = document.getElementById('profile-admin-btn');
    const user = App.currentUser;
    if (!user || !modal) return;

    if (username) username.textContent = user.username;
    if (email) email.textContent = user.email;
    if (adminBtn) adminBtn.classList.toggle('hidden', !user.is_admin);

    const orderCount = App.orderHistory.length;
    const totalItems = App.orderHistory.reduce((sum, order) => sum + (order.items || []).reduce((s, i) => s + Number(i.quantity || 1), 0), 0);
    const totalSpent = App.orderHistory.reduce((sum, order) => sum + Number(order.total || 0), 0);
    const joined = user.created_at ? new Date(user.created_at).toLocaleDateString() : '—';

    if (stats) {
      stats.innerHTML = `
        <div class="profile-stat"><div class="profile-stat-value">${(user.points || 0).toLocaleString()}</div><div class="profile-stat-label">Points</div></div>
        <div class="profile-stat"><div class="profile-stat-value">${orderCount}</div><div class="profile-stat-label">Orders</div></div>
        <div class="profile-stat"><div class="profile-stat-value">${totalItems}</div><div class="profile-stat-label">Items Ordered</div></div>
        <div class="profile-stat"><div class="profile-stat-value">${Cart.formatPrice(totalSpent)}</div><div class="profile-stat-label">Total Spent</div></div>
        <div class="profile-stat"><div class="profile-stat-value">${joined}</div><div class="profile-stat-label">Member Since</div></div>
        <div class="profile-stat"><div class="profile-stat-value">${user.is_admin ? 'Admin' : 'Member'}</div><div class="profile-stat-label">Account Type</div></div>
      `;
    }

    modal.classList.remove('hidden');
    modal.classList.add('open');
  },

  closeProfileModal: function () {
    const modal = document.getElementById('profile-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('open');
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
        ? (event) => { event.preventDefault(); App.openRewardsModal(); }
        : (event) => { event.preventDefault(); App.openAuthModal('login'); };
    }
  },

  confirmExit: function (event) {
    if (!Cart.items.length && !App.lastOrder) return;
    event.preventDefault();
    event.returnValue = '';
  },

  saveLastOrder: function (result, address) {
    App.lastOrder = { order: result.order, placedAt: Date.now(), address };
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
      if (saved && saved.order && typeof saved.order.id === 'string' && Number.isFinite(Number(saved.placedAt))) {
        App.lastOrder = saved;
      }
    } catch (error) {
      console.error('[App] Could not restore recent order:', error);
    }
    App.updateSeeOrderButton();
  },

  updateSeeOrderButton: function () {
    const fab = document.getElementById('track-order-fab');
    const fabText = fab?.querySelector('.track-order-fab-text');
    if (fab) {
      fab.classList.toggle('hidden', !App.lastOrder);
      if (fabText && App.lastOrder) fabText.textContent = `Track order #${App.lastOrder.order.id.slice(0, 6)}`;
    }
  },

  showAlert: function (message) {
    const modal = document.getElementById('alert-modal');
    const text = document.getElementById('alert-modal-message');
    if (!modal || !text) return;
    text.textContent = message;
    modal.classList.remove('hidden');
    document.getElementById('alert-modal-ok')?.focus();
  },

  hideAlert: function () {
    document.getElementById('alert-modal')?.classList.add('hidden');
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
    if (!data.catalog?.length && status) status.textContent = 'There are no rewards available right now.';
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
      Cart.appliedCoupon = { code: result.code, discount_pct: Number(result.discount_pct), reward_product_id: result.reward_product_id || '' };
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
      await App.loadOrderHistory();
      App.updateMemberUI();
      App.closeAuthModal();
      App.renderRecommendedSection();
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
      Cart.showToast('Account created. Welcome to CrunchBox!', 'success');
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
      App.orderHistory = [];
      App.updateMemberUI();
      App.renderRecommendedSection();
      App.closeProfileModal();
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
    Tracker.startStages({ stagePrefix: 'stage-', supportId: 'order-support-box', totalStages: 5, startedAt: savedOrder?.placedAt || Date.now() });
  },

  closeOrderModal: function () {
    const modal = document.getElementById('order-modal');
    modal?.classList.add('hidden');
    modal?.classList.remove('open');
  },

  escapeHTML: function (value) {
    return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  },
};

document.addEventListener('DOMContentLoaded', () => App.init());
