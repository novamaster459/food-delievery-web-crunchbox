// Shopping cart and checkout interactions.
const Cart = {
  items: [],
  currentUser: null,
  appliedCoupon: null,
  memberDiscountPct: 10,

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
      });
    }
    Cart.render();
    Cart.updateBadge();
  },

  updateQuantity: function (productId, quantity) {
    const item = Cart.items.find((entry) => entry.product_id === String(productId));
    if (!item) return;
    if (quantity < 1) Cart.items = Cart.items.filter((entry) => entry !== item);
    else item.quantity = Math.min(99, quantity);
    Cart.render();
    Cart.updateBadge();
  },

  calculateTotals: function () {
    const subtotal = Cart.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const memberDiscount = Cart.currentUser
      ? Cart.items.reduce((sum, item) => sum + Math.floor(item.unit_price * item.quantity * Cart.memberDiscountPct / 100), 0)
      : 0;
    const comboSavings = Cart.items.reduce((sum, item) => {
      if (!item.is_combo) return sum;
      const memberSaving = Cart.currentUser
        ? Math.floor(item.unit_price * item.quantity * Cart.memberDiscountPct / 100)
        : 0;
      const discountedBase = item.unit_price * item.quantity - memberSaving;
      return sum + Math.floor(discountedBase * item.combo_discount_pct / 100);
    }, 0);
    const couponBase = Math.max(0, subtotal - comboSavings - memberDiscount);
    const couponSavings = Cart.appliedCoupon
      ? Math.floor(couponBase * Cart.appliedCoupon.discount_pct / 100)
      : 0;
    return {
      subtotal,
      comboSavings,
      memberDiscount,
      couponSavings,
      total: Math.max(0, subtotal - comboSavings - memberDiscount - couponSavings),
    };
  },

  render: function () {
    const list = document.getElementById('cart-items');
    if (!list) return;
    list.replaceChildren();
    if (!Cart.items.length) {
      const empty = document.createElement('div');
      empty.className = 'cart-empty';
      empty.textContent = 'Your cart is empty. Add something delicious!';
      list.appendChild(empty);
    } else {
      Cart.items.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'cart-item';
        const info = document.createElement('div');
        info.className = 'cart-item-info';
        info.innerHTML = `<span class="cart-item-name">${App.escapeHTML(item.name)}</span><span class="cart-item-price">${Cart.formatPrice(item.unit_price)}</span>`;
        const controls = document.createElement('div');
        controls.className = 'cart-item-controls';
        const minus = Cart.createButton('−', 'decrease');
        const quantity = document.createElement('span');
        quantity.className = 'qty-value';
        quantity.textContent = item.quantity;
        const plus = Cart.createButton('+', 'increase');
        const remove = Cart.createButton('Remove', 'remove');
        remove.className = 'remove-btn';
        controls.append(minus, quantity, plus, remove);
        const lineTotal = document.createElement('span');
        lineTotal.className = 'cart-item-line-total';
        lineTotal.textContent = Cart.formatPrice(item.unit_price * item.quantity);
        row.append(info, controls, lineTotal);
        minus.addEventListener('click', () => Cart.updateQuantity(item.product_id, item.quantity - 1));
        plus.addEventListener('click', () => Cart.updateQuantity(item.product_id, item.quantity + 1));
        remove.addEventListener('click', () => Cart.updateQuantity(item.product_id, 0));
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
    if (checkout) checkout.disabled = !Cart.items.length;
    const couponInput = document.getElementById('coupon-input');
    if (couponInput && Cart.appliedCoupon) couponInput.value = Cart.appliedCoupon.code;
  },

  createButton: function (text, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'qty-btn';
    button.dataset.action = action;
    button.textContent = text;
    return button;
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
      Cart.appliedCoupon = { code: result.code, discount_pct: Number(result.discount_pct) };
      if (status) status.textContent = `${result.code} applied (${result.discount_pct}% off).`;
      Cart.render();
    } catch (error) {
      Cart.appliedCoupon = null;
      Cart.render();
      if (status) status.textContent = error.message;
    }
  },

  handleCheckout: async function () {
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
        items: Cart.items.map(({ product_id, quantity }) => ({ product_id, quantity })),
        coupon_code: Cart.appliedCoupon?.code || '',
        address,
      });
      if (App.currentUser && Number.isFinite(result.loyalty?.points_balance)) {
        App.currentUser.points = result.loyalty.points_balance;
        App.updateRewardsUI();
      }
      Cart.clear();
      Cart.close();
      App.openOrderModal(result);
      if (result.loyalty?.points_earned > 0) {
        Cart.showToast(`You earned ${result.loyalty.points_earned} loyalty points!`, 'success');
      }
    } catch (error) {
      Cart.showToast(error.message || 'Checkout failed.', 'error');
    } finally {
      if (button) {
        button.textContent = 'Place Order 🍗';
        button.disabled = Cart.items.length === 0;
      }
    }
  },

  clear: function () {
    Cart.items = [];
    Cart.appliedCoupon = null;
    Cart.render();
    Cart.updateBadge();
  },

  formatPrice: function (amount) {
    return `${Number(amount || 0).toLocaleString('en-US')} MMK`;
  },

  showToast: function (message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => toast.remove(), 3500);
  },
};
