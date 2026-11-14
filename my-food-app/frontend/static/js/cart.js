// Shopping cart and checkout interactions.
const Cart = {
  storageKey: 'crunchbox-cart-v1',
  items: [],
  currentUser: null,
  appliedCoupon: null,
  memberDiscountPct: 10,
  openRequests: new Set(),

  loadItems: function () {
    try {
      const saved = JSON.parse(localStorage.getItem(Cart.storageKey) || '{}');
      const items = Array.isArray(saved) ? saved : saved.items;
      Cart.appliedCoupon = Array.isArray(saved) ? null : (saved.appliedCoupon || null);
      return Array.isArray(items)
        ? items.filter((item) => item && typeof item.product_id === 'string' && Number.isInteger(item.quantity) && item.quantity > 0)
        : [];
    } catch (error) {
      console.error('[Cart] Could not restore saved cart:', error);
      return [];
    }
  },

  saveState: function () {
    try {
      localStorage.setItem(Cart.storageKey, JSON.stringify({ items: Cart.items, appliedCoupon: Cart.appliedCoupon }));
    } catch (error) {
      console.error('[Cart] Could not save cart:', error);
    }
  },

  addItem: function (product) {
    const item = Cart.items.find((entry) => entry.product_id === String(product.id));
    if (item) item.quantity += 1;
    else {
      Cart.items.push({
        product_id: String(product.id),
        name: product.name,
        unit_price: Number(product.price),
        quantity: 1,
        is_combo: Boolean(product.is_combo),
        combo_discount_pct: Number(product.combo_discount_pct || 0),
        loyalty_points: Number(product.loyalty_points || 0),
        special_request: '',
      });
    }
    Cart.saveState();
    Cart.render();
    Cart.updateBadge();
  },

  updateQuantity: function (productId, quantity) {
    const item = Cart.items.find((entry) => entry.product_id === String(productId));
    if (!item) return;
    if (quantity < 1) Cart.items = Cart.items.filter((entry) => entry !== item);
    else item.quantity = Math.min(99, quantity);
    Cart.saveState();
    Cart.render();
    Cart.updateBadge();
  },

  reconcileWithMenu: function (menuData) {
    const products = (menuData || []).flatMap((category) => category.products || []);
    if (!products.length || !Cart.items.length) return;
    const byName = new Map(products.map((product) => [product.name, product]));
    let changed = false;
    let dropped = 0;
    Cart.items = Cart.items.filter((item) => {
      const product = products.find((entry) => String(entry.id) === item.product_id) || byName.get(item.name);
      if (!product) {
        dropped += 1;
        changed = true;
        return false;
      }
      const next = {
        product_id: String(product.id),
        unit_price: Number(product.price),
        is_combo: Boolean(product.is_combo),
        combo_discount_pct: Number(product.combo_discount_pct || 0),
        loyalty_points: Number(product.loyalty_points || 0),
      };
      for (const [key, value] of Object.entries(next)) {
        if (item[key] !== value) {
          item[key] = value;
          changed = true;
        }
      }
      return true;
    });
    if (!changed) return;
    Cart.saveState();
    Cart.render();
    Cart.updateBadge();
    if (dropped) Cart.showToast('Some saved items are no longer on the menu and were removed.', 'info');
  },

  calculateTotals: function () {
    const subtotal = Cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const memberDiscount = Cart.currentUser
      ? Cart.items.reduce((sum, item) => sum + Math.floor(item.unit_price * item.quantity * Cart.memberDiscountPct / 100), 0)
      : 0;
    const comboSavings = Cart.items.reduce((sum, item) => {
      if (!item.is_combo) return sum;
      const memberSaving = Cart.currentUser ? Math.floor(item.unit_price * item.quantity * Cart.memberDiscountPct / 100) : 0;
      const discountedBase = item.unit_price * item.quantity - memberSaving;
      return sum + Math.floor(discountedBase * item.combo_discount_pct / 100);
    }, 0);
    const couponBase = Math.max(0, subtotal - comboSavings - memberDiscount);
    let couponSavings = 0;
    if (Cart.appliedCoupon?.reward_product_id) {
      const rewardItem = Cart.items.find((item) => item.product_id === String(Cart.appliedCoupon.reward_product_id));
      if (rewardItem) {
        const memberPerUnit = Cart.currentUser ? Math.floor(rewardItem.unit_price * Cart.memberDiscountPct / 100) : 0;
        const comboPerUnit = rewardItem.is_combo ? Math.floor((rewardItem.unit_price - memberPerUnit) * rewardItem.combo_discount_pct / 100) : 0;
        couponSavings = Math.max(0, rewardItem.unit_price - memberPerUnit - comboPerUnit);
      }
    } else if (Cart.appliedCoupon) {
      couponSavings = Math.floor(couponBase * Cart.appliedCoupon.discount_pct / 100);
    }
    return { subtotal, comboSavings, memberDiscount, couponSavings, total: Math.max(0, subtotal - comboSavings - memberDiscount - couponSavings) };
  },

  render: function () {
    const list = document.getElementById('cart-items');
    if (!list) return;
    list.replaceChildren();
    if (!Cart.items.length) {
      list.innerHTML = `
        <div class="cart-empty">
          <svg class="cart-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 6h15l-1.5 9h-12z"></path>
            <circle cx="9" cy="20" r="1.5"></circle>
            <circle cx="18" cy="20" r="1.5"></circle>
            <path d="M6 6L5 3H2"></path>
          </svg>
          <p>Your cart is empty.<br/>Add some delicious items!</p>
        </div>`;
    } else {
      Cart.items.forEach((item) => {
        const product = App.allProducts().find((p) => p.id === item.product_id);
        const imgUrl = product?.image_url || '/static/images/icons/icon-main.png';
        const row = document.createElement('div');
        row.className = 'cart-item';
        row.innerHTML = `
          <img src="${App.escapeHTML(imgUrl)}" alt="" class="cart-item-img" onerror="this.src='/static/images/icons/icon-main.png'" />
          <div class="cart-item-info">
            <span class="cart-item-name">${App.escapeHTML(item.name)}</span>
            <span class="cart-item-price">${Cart.formatPrice(item.unit_price)}</span>
          </div>
          <div class="cart-item-qty">
            <button class="qty-btn" type="button" data-action="decrease">−</button>
            <span class="qty-num">${item.quantity}</span>
            <button class="qty-btn" type="button" data-action="increase">+</button>
          </div>
        `;
        row.querySelector('[data-action="decrease"]').addEventListener('click', () => Cart.updateQuantity(item.product_id, item.quantity - 1));
        row.querySelector('[data-action="increase"]').addEventListener('click', () => Cart.updateQuantity(item.product_id, item.quantity + 1));
        list.appendChild(row);
      });
    }

    const totals = Cart.calculateTotals();
    Cart.setText('cart-subtotal', Cart.formatPrice(totals.subtotal));
    Cart.setText('cart-total', Cart.formatPrice(totals.total));
    Cart.setDiscountRow('member-discount-row', 'member-discount-amt', totals.memberDiscount);
    Cart.setDiscountRow('combo-discount-row', 'combo-discount-amt', totals.comboSavings);
    Cart.setDiscountRow('coupon-discount-row', 'coupon-discount-amt', totals.couponSavings);

    const checkout = document.getElementById('checkout-btn');
    if (checkout) {
      const closed = typeof App !== 'undefined' && App.storeOpen === false;
      checkout.disabled = !Cart.items.length || closed;
      checkout.textContent = closed ? 'Closed — opens during opening hours' : 'Place Order';
    }
    const clearButton = document.getElementById('cart-clear-btn');
    if (clearButton) clearButton.disabled = !Cart.items.length;
    const couponInput = document.getElementById('coupon-input');
    if (couponInput && Cart.appliedCoupon) couponInput.value = Cart.appliedCoupon.code;
  },

  setText: function (id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  },

  setDiscountRow: function (rowId, amountId, amount) {
    const row = document.getElementById(rowId);
    if (!row) return;
    row.classList.toggle('hidden', amount <= 0);
    Cart.setText(amountId, `−${Cart.formatPrice(amount)}`);
  },

  updateBadge: function () {
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = String(Cart.items.reduce((sum, item) => sum + item.quantity, 0));
  },

  open: function () {
    document.getElementById('cart-sidebar')?.classList.remove('hidden');
    document.getElementById('cart-sidebar')?.classList.add('open');
    document.getElementById('cart-overlay')?.classList.remove('hidden');
    document.getElementById('cart-overlay')?.classList.add('active');
  },

  close: function () {
    document.getElementById('cart-sidebar')?.classList.remove('open');
    document.getElementById('cart-sidebar')?.classList.add('hidden');
    document.getElementById('cart-overlay')?.classList.remove('active');
    document.getElementById('cart-overlay')?.classList.add('hidden');
  },

  handleCouponApply: async function () {
    const input = document.getElementById('coupon-input');
    const status = document.getElementById('coupon-status');
    const code = input?.value.trim().toUpperCase();
    if (!code) {
      if (status) status.textContent = 'Enter a coupon code first.';
      return;
    }
    try {
      const result = await API.validateCoupon(code);
      if (!result.valid) throw new Error(result.reason || 'This coupon is not valid.');
      Cart.appliedCoupon = {
        code: result.code,
        discount_pct: Number(result.discount_pct),
        reward_product_id: result.reward_product_id || '',
      };
      Cart.saveState();
      if (status) {
        status.textContent = result.reward_product_name
          ? `${result.code} applied to one ${result.reward_product_name}.`
          : `${result.code} applied (${result.discount_pct}% off).`;
      }
      Cart.render();
    } catch (error) {
      Cart.appliedCoupon = null;
      Cart.saveState();
      Cart.render();
      if (status) status.textContent = error.message;
    }
  },

  handleCheckout: async function () {
    if (typeof App !== 'undefined' && App.storeOpen === false) {
      App.showAlert(App.closedMessage());
      return;
    }
    const { valid, address } = LocationManager.validateAddress();
    if (!valid) {
      Cart.showToast('Choose a city, township, ward and street, then enter your house or room number.', 'error');
      return;
    }
    if (!Cart.items.length) return;

    const button = document.getElementById('checkout-btn');
    if (button) {
      button.disabled = true;
      button.textContent = 'Placing order…';
    }
    try {
      const result = await API.checkout({
        items: Cart.items.map(({ product_id, quantity, special_request }) => ({ product_id, quantity, special_request: special_request || '' })),
        coupon_code: Cart.appliedCoupon?.code || '',
        address,
      });
      App.saveLastOrder(result, address);
      if (App.currentUser && Number.isFinite(result.loyalty?.points_balance)) {
        App.currentUser.points = result.loyalty.points_balance;
        App.updateRewardsUI();
      }
      Cart.clear();
      Cart.close();
      App.openOrderModal(result.order, App.lastOrder);
      if (result.loyalty?.points_earned > 0) Cart.showToast(`You earned ${result.loyalty.points_earned} loyalty points!`, 'success');
    } catch (error) {
      if (/not found/i.test(error.message || '')) {
        await App.loadMenu();
        Cart.reconcileWithMenu(App.menuData);
        Cart.showToast('Your saved order was refreshed with the current menu. Please review it and try again.', 'info');
      } else if (/all branches are closed/i.test(error.message || '')) {
        if (typeof App !== 'undefined') App.showAlert(error.message);
      } else {
        Cart.showToast(error.message || 'Checkout failed.', 'error');
      }
    } finally {
      if (button) {
        const closed = typeof App !== 'undefined' && App.storeOpen === false;
        button.textContent = closed ? 'Closed — opens during opening hours' : 'Place Order';
        button.disabled = closed || Cart.items.length === 0;
      }
    }
  },

  clear: function () {
    Cart.items = [];
    Cart.appliedCoupon = null;
    Cart.openRequests.clear();
    Cart.saveState();
    Cart.render();
    Cart.updateBadge();
  },

  formatPrice: function (amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} MMK`;
  },

  showToast: function (message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    const container = document.getElementById('toast-container') || document.body;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  },
};

Cart.items = Cart.loadItems();
