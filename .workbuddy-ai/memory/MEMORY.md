# CrunchBox Project Memory

## Project Overview
- Flask backend + vanilla JS frontend food delivery app
- Backend path: `my-food-app/backend/app.py`
- Frontend path: `my-food-app/frontend/`
- Python with Flask: use `C:\Users\HP\AppData\Local\Programs\Python\Python314\python.exe`
- No virtual env; Flask 3.0.3 installed in system Python 3.14

## Major UI/UX Redesign (completed 2026-11-13)
- Rewrote: `index.html`, `main.css`, `main.js`, `cart.js`
- Color palette: black(#0a0a0a) → red(#e60012) → orange(#ff5e00) → yellow(#ffd000) → white
- Fonts: Google Fonts Outfit + Poppins
- All emoji removed from all templates, JS files, and CSS `::before` rules
- SVG inline icons used everywhere (nav, admin sidebar, luck games, track stages, etc.)
- Custom icon PNGs in `frontend/static/images/icons/` for category tabs
- Bestseller ribbon PNG overlay on cards
- Special tabs: POPULAR TODAY, Recommended, New (prepended before category tabs)
- Product detail modal (click card to open, plus button adds directly)
- Profile modal shows points, order count, total spent, member since
- Bottom nav: active tab yellow outline, Luck icon bounces, FAB gradient
- Silver borders on menu cards, jump animations on attention buttons
- `components.css` badge `::before` emoji cleared (set to empty string)

## Backend Notes
- 6 categories: Mains, Vegan Main Meal, Drinks, Appetizers, Desserts, Special Combo Sets
- `is_bestseller`: requires >=2 units sold, only single top seller
- `is_new`: single newest product within 30 days
- With fresh seed data (no orders), both flags are False — expected behavior
- Category API returns `{icon, id, name, products: [...]}` — products nested inside categories
