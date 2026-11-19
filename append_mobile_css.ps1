$css = @'

/* ══════════════════════════════════════════════════════════════════════════════════
   MOBILE COMPATIBILITY ENHANCEMENTS
   Fixes: header logo/cart overlap, bottom nav spacing, safe areas, touch targets
   ═════════════════════════════════════════════════════════════════════════════════ */

/* Very small phones (up to 480px) */
@media (max-width: 480px) {
  body {
    padding-top: 56px !important;
    padding-bottom: 70px !important;
  }

  /* Header: prevent logo/cart overlap, use natural flex layout */
  .app-header {
    height: 56px !important;
    padding: 0 10px !important;
    gap: 8px !important;
    flex-wrap: nowrap !important;
  }

  .shop-logo-area {
    position: static !important;
    transform: none !important;
    flex: 0 1 auto !important;
    min-width: 0 !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 0 !important;
    background: transparent !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }

  #shop-logo {
    width: 34px !important;
    height: 34px !important;
    flex-shrink: 0 !important;
  }

  .shop-name-text {
    font-size: 17px !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 140px !important;
  }

  .header-right {
    flex: 0 0 auto !important;
    display: flex !important;
    align-items: center !important;
    gap: 6px !important;
    margin-left: auto !important;
  }

  .cart-btn {
    padding: 6px 10px !important;
    font-size: 13px !important;
    gap: 4px !important;
    min-width: auto !important;
  }

  .cart-btn svg {
    width: 18px !important;
    height: 18px !important;
  }

  .cart-badge {
    min-width: 16px !important;
    height: 16px !important;
    font-size: 10px !important;
    padding: 0 3px !important;
  }

  .admin-shortcut {
    display: none !important;
  }

  /* Bottom nav: tighter spacing, bigger touch targets, safe area */
  .bottom-nav {
    height: 64px !important;
    padding: 0 6px !important;
    padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
    border-radius: 0 !important;
  }

  .bottom-nav-item {
    padding: 6px 2px !important;
    gap: 3px !important;
    min-width: 0 !important;
    border-radius: 10px !important;
  }

  .bottom-nav-item .nav-icon {
    width: 24px !important;
    height: 24px !important;
  }

  .bottom-nav-item.active {
    padding: 6px 4px !important;
    border-radius: 10px !important;
  }

  .nav-label {
    font-size: 9px !important;
    letter-spacing: 0.2px !important;
    line-height: 1 !important;
  }

  .cart-badge-nav {
    min-width: 18px !important;
    height: 18px !important;
    font-size: 10px !important;
    top: -6px !important;
    right: -6px !important;
  }

  .app-header {
    padding-top: max(6px, env(safe-area-inset-top)) !important;
  }
}

/* Medium phones (481px - 767px) */
@media (min-width: 481px) and (max-width: 767px) {
  .app-header {
    height: 60px !important;
    padding: 0 14px !important;
  }

  .shop-logo-area {
    position: static !important;
    transform: none !important;
    padding: 0 !important;
    background: transparent !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }

  #shop-logo {
    width: 40px !important;
    height: 40px !important;
  }

  .shop-name-text {
    font-size: 19px !important;
  }

  .header-right {
    margin-left: auto !important;
  }

  .cart-btn {
    padding: 7px 12px !important;
    font-size: 14px !important;
  }

  .cart-btn svg {
    width: 19px !important;
    height: 19px !important;
  }

  .bottom-nav {
    height: 68px !important;
    padding-bottom: max(10px, env(safe-area-inset-bottom)) !important;
  }

  .bottom-nav-item {
    padding: 7px 3px !important;
  }

  .bottom-nav-item .nav-icon {
    width: 26px !important;
    height: 26px !important;
  }

  .nav-label {
    font-size: 10px !important;
  }
}

/* Ensure content isn't hidden behind fixed header/nav on all mobile */
@media (max-width: 767px) {
  .luck-page,
  .locations-page,
  .hero-section {
    padding-bottom: calc(var(--bottom-nav-h, 74px) + 20px) !important;
  }

  .menu-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    gap: 10px !important;
  }

  .category-tabs {
    gap: 8px !important;
    padding: 4px 12px 12px !important;
  }

  .tab-btn {
    min-width: 70px !important;
    min-height: 66px !important;
    padding: 8px 6px !important;
  }

  .search-container {
    padding: 16px 12px 10px !important;
  }

  .search-pill {
    padding: 0 12px !important;
  }

  .promo-section {
    display: grid !important;
    grid-template-columns: 1fr !important;
    gap: 12px !important;
    padding: 0 12px !important;
  }

  .rewards-panel {
    margin: 0 12px 20px !important;
    padding: 16px !important;
  }

  .store-locations-section {
    padding: 0 12px 20px !important;
  }

  .cart-sidebar {
    width: 100vw !important;
  }

  .product-modal-box,
  .profile-modal-box,
  .auth-modal-box {
    width: calc(100vw - 24px) !important;
    max-width: calc(100vw - 24px) !important;
    margin: 12px !important;
  }

  .modal {
    padding: 12px !important;
    align-items: flex-end !important;
    justify-content: center !important;
  }

  .modal-box {
    border-radius: var(--radius-lg) var(--radius-lg) 0 0 !important;
    max-height: 90dvh !important;
  }
}

/* Touch target enhancements for all interactive elements on mobile */
@media (max-width: 767px) {
  button, [role='button'] {
    min-height: 44px !important;
  }

  .bottom-nav-item {
    min-height: 56px !important;
  }

  .cart-btn {
    min-height: 44px !important;
  }

  .btn-primary,
  .btn-secondary {
    min-height: 44px !important;
    padding: 12px 20px !important;
    font-size: 15px !important;
  }

  .form-input {
    min-height: 44px !important;
    font-size: 16px !important;
  }

  select.form-input {
    font-size: 16px !important;
  }
}

/* Prevent horizontal overflow on mobile */
@media (max-width: 767px) {
  body {
    overflow-x: hidden !important;
  }

  .menu-card-img-wrap {
    aspect-ratio: 1.1 !important;
    max-height: 140px !important;
  }

  .menu-card-body {
    padding: 10px !important;
  }

  .menu-card-name {
    font-size: 14px !important;
  }

  .menu-card-price {
    font-size: 15px !important;
  }

  .add-to-cart-btn {
    width: 34px !important;
    height: 34px !important;
    font-size: 20px !important;
  }
}
'@ | Out-File -FilePath 'C:\Users\HP\Desktop\crunchbox\my-food-app\frontend\static\css\main.css' -Encoding utf8 -Append
