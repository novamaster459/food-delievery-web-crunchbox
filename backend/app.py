"""
app.py — CrunchBox Backend Entry Point
=======================================
Bootstraps the Flask application, populates the in-memory data store with
seed data, registers route blueprints, and exposes a small set of core API
routes for settings and the public menu.

Run directly:
    python app.py

The app listens on http://0.0.0.0:5000 in debug mode.
"""

import os
import json
import re
import sys
from datetime import datetime, timedelta

from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash

from models import BranchLocation, Category, Coupon, Order, Product, User, Playlist

# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

app = Flask(__name__, static_folder=None)

# Secret key for Flask session signing (change in production!)
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(32)

# Allow file uploads up to 16 MB
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

# Path where uploaded images (product photos, logo) are stored.
# Relative to this file's location so it resolves to frontend/static/uploads/.
UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "..", "frontend", "static", "uploads")
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

# Ensure the upload directory exists at startup
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Enable Cross-Origin Resource Sharing so a separate frontend dev server can
# reach this API without browser CORS errors.
CORS(app, supports_credentials=True)

# ---------------------------------------------------------------------------
# In-Memory Data Store
# ---------------------------------------------------------------------------
# `db` is the single source of truth for the entire application.
# All blueprints import this dict and mutate it directly.

db: dict = {
    "users": [],       # List[User]
    "categories": [],  # List[Category]
    "products": [],    # List[Product]
    "coupons": [],     # List[Coupon]
    "orders": [],      # List[Order]
    "locations": [],   # List[BranchLocation]
    "playlists": [],  # List[Playlist]
    "settings": {
        "shop_name": "CrunchBox",
        "logo_filename": "",
        "member_discount_pct": 10.0,   # % discount for logged-in members
        "combo_discount_pct": 15.0,    # Default % discount for combo products
        "reward_iced_cola_points": 2000,
        "reward_spicy_crunch_burger_points": 8000,
        "reward_crispy_chicken_bucket_points": 20000,
        "accent_color": "#AE150D",
        "background_color": "#ffffff",
        "hero_heading": "Crispy Flavor,\nDelivered Fast.",
        "hero_subtext": "Hot, crunchy & made fresh for you.",
        "hero_image_filename": "chef-special.jpg",
        "featured_title": "Chef Specials",
        "featured_text": "Made with love by our chefs — unique recipes you won't find anywhere else.",
        "featured_image_filename": "chef-special.jpg",
        "deal_title": "Weekend Crunch Fest",
        "deal_text": "Up to 25% OFF on selected items. Limited time only!",
        "deal_button_text": "Order Now",
        "deal_image_filename": "menu-party-pack.jpg",
    },
}


# ---------------------------------------------------------------------------
# Seed Data
# ---------------------------------------------------------------------------

# The three built-in reward items keep their point costs in `settings` so the
# admin Settings tab and the per-product reward option stay in sync.
REWARD_PRODUCT_SETTINGS = {
    "Iced Cola": "reward_iced_cola_points",
    "Spicy Crunch Burger": "reward_spicy_crunch_burger_points",
    "Crispy Chicken Bucket": "reward_crispy_chicken_bucket_points",
}


def sync_reward_product_points(keys=None) -> None:
    """Mirror reward point settings onto the matching seeded products."""
    for product in db["products"]:
        setting_key = REWARD_PRODUCT_SETTINGS.get(product.name)
        if not setting_key or (keys is not None and setting_key not in keys):
            continue
        product.is_reward = True
        product.reward_points = int(db["settings"].get(setting_key, 0))

def seed_data() -> None:
    """
    Populate `db` with realistic demo data so the app works straight away
    without any manual setup.  Called once at process startup.
    """

    # ------------------------------------------------------------------
    # Users
    # ------------------------------------------------------------------
    db["users"].append(User(
        username="admin",
        email=os.environ.get("ADMIN_EMAIL", "admin@crunchbox.com"),
        password_hash=generate_password_hash(os.environ.get("ADMIN_PASSWORD", "admin123")),
        is_admin=True,
    ))

    db["users"].append(User(
        username="john_doe",
        email="john@example.com",
        password_hash=generate_password_hash("password123"),
        is_admin=False,
        points=1250,
    ))

    # ------------------------------------------------------------------
    # Live production snapshot (captured 2026-11-19 from
    # food-delievery-web-crunchbox-production.up.railway.app).
    # Categories, products, playlists and branch locations are rebuilt
    # exactly as they exist on the live site so a redeploy never wipes the
    # real menu data. Edit backend/seed_snapshot.json to change it.
    # ------------------------------------------------------------------
    with open(os.path.join(os.path.dirname(__file__), "seed_snapshot.json"),
              encoding="utf-8") as _snap_file:
        _snap = json.load(_snap_file)

    for _cat in _snap["menu"]:
        category = Category(
            id=_cat["id"],
            name=_cat["name"],
            icon=_cat.get("icon", ""),
            sort_order=int(_cat.get("sort_order", 0)),
        )
        db["categories"].append(category)

        for _pl in _cat.get("playlists", []):
            db["playlists"].append(Playlist(
                id=_pl["id"],
                name=_pl["name"],
                category_id=category.id,
                product_ids=list(_pl.get("product_ids", [])),
                sort_order=int(_pl.get("sort_order", 0)),
            ))

        for _prod in _cat.get("products", []):
            db["products"].append(Product(
                id=_prod["id"],
                category_id=category.id,
                name=_prod["name"],
                description=_prod.get("description", ""),
                price=int(_prod.get("price", 0)),
                image_filename=_prod.get("image_filename", ""),
                is_available=bool(_prod.get("is_available", True)),
                is_combo=bool(_prod.get("is_combo", False)),
                combo_discount_pct=float(_prod.get("combo_discount_pct", 0.0)),
                loyalty_points=int(_prod.get("loyalty_points", 100)),
                is_reward=bool(_prod.get("is_reward", False)),
                reward_points=int(_prod.get("reward_points", 0)),
                created_at=datetime.fromisoformat(_prod["created_at"]),
            ))

    for _loc in _snap["locations"]:
        db["locations"].append(BranchLocation(
            id=_loc["id"],
            name=_loc["name"],
            branch_no=str(_loc.get("branch_no", "")),
            address=_loc.get("address", ""),
            open_time=_loc.get("open_time", "09:00"),
            close_time=_loc.get("close_time", "22:00"),
            image_filename=_loc.get("image_filename", ""),
        ))

    # Visual settings from the live site (hero / featured / deal photos,
    # titles, colours) so the storefront matches production.
    _live_settings = _snap.get("settings", {})
    for _key, _val in _live_settings.items():
        if _key.endswith("_url"):
            _fname_key = _key[:-4] + "_filename"
            _fname = str(_val).rsplit("/", 1)[-1] if _val else ""
            if _fname:
                db["settings"][_fname_key] = _fname
        elif _key in db["settings"]:
            db["settings"][_key] = _val

    # Mark the built-in reward items so members can redeem them with points.
    sync_reward_product_points()


# Run seed on startup (safe to call multiple times in a dev-reload scenario
# because we only call it once here at module level).
seed_data()

# ---------------------------------------------------------------------------
# Blueprint Registration  (imported after db is defined to avoid circular refs)
# ---------------------------------------------------------------------------

# Keep direct `python app.py` execution on the same module instance used by
# blueprints, which import the shared in-memory store from `app`.
if __name__ == "__main__":
    sys.modules["app"] = sys.modules[__name__]

from routes.auth import auth_bp      # noqa: E402
from routes.admin import admin_bp    # noqa: E402
from routes.orders import orders_bp  # noqa: E402
from routes.games import games_bp    # noqa: E402

app.register_blueprint(auth_bp,   url_prefix="/api/auth")
app.register_blueprint(admin_bp,  url_prefix="/api/admin")
app.register_blueprint(orders_bp, url_prefix="/api/orders")
app.register_blueprint(games_bp,  url_prefix="/api/games")


# ---------------------------------------------------------------------------
# Settings Routes
# ---------------------------------------------------------------------------

@app.route("/api/settings", methods=["GET"])
def get_settings():
    """Return the current shop settings (public)."""
    settings = dict(db["settings"])
    for key in ("logo", "hero_image", "featured_image", "deal_image"):
        filename = settings.pop(f"{key}_filename", "")
        settings[f"{key}_url"] = f"/static/uploads/{filename}" if filename else ""
    return jsonify(settings)


@app.route("/api/settings", methods=["POST"])
def update_settings():
    """
    Update shop_name and/or logo_filename.
    Requires an active admin session.
    """
    if not session.get("is_admin"):
        return jsonify({"error": "Admin access required"}), 403

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Settings must be sent as a JSON object"}), 400

    if "shop_name" in data:
        shop_name = str(data["shop_name"]).strip()
        if not shop_name or len(shop_name) > 60:
            return jsonify({"error": "Shop name must be between 1 and 60 characters"}), 400
        db["settings"]["shop_name"] = shop_name
    if "member_discount_pct" in data:
        try:
            discount = float(data["member_discount_pct"])
        except (TypeError, ValueError):
            return jsonify({"error": "Member discount must be a number"}), 400
        if not 0 <= discount <= 100:
            return jsonify({"error": "Member discount must be between 0 and 100"}), 400
        db["settings"]["member_discount_pct"] = discount

    text_limits = {
        "hero_heading": 100,
        "hero_subtext": 180,
        "featured_title": 60,
        "featured_text": 240,
        "deal_title": 60,
        "deal_text": 180,
        "deal_button_text": 30,
    }
    for key, limit in text_limits.items():
        if key in data:
            value = str(data[key]).strip()
            if not value or len(value) > limit:
                return jsonify({"error": f"{key} must be between 1 and {limit} characters"}), 400
            db["settings"][key] = value

    point_settings = (
        "reward_iced_cola_points",
        "reward_spicy_crunch_burger_points",
        "reward_crispy_chicken_bucket_points",
    )
    changed_reward_settings = set()
    for key in point_settings:
        if key in data:
            try:
                points = int(data[key])
            except (TypeError, ValueError):
                return jsonify({"error": f"{key} must be a whole number"}), 400
            if points < 1 or points > 1_000_000:
                return jsonify({"error": f"{key} must be between 1 and 1,000,000"}), 400
            db["settings"][key] = points
            changed_reward_settings.add(key)

    if changed_reward_settings:
        sync_reward_product_points(changed_reward_settings)

    for key in ("accent_color", "background_color"):
      if key in data:
        color = str(data[key]).strip()
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", color):
          return jsonify({"error": f"{key} must be a six-digit hex color"}), 400
        db["settings"][key] = color.lower()

    # Allow admins to clear image filenames (remove logo / promo images)
    for key in ("logo_filename", "hero_image_filename", "featured_image_filename", "deal_image_filename"):
      if key in data:
        value = data[key]
        if value is None or (isinstance(value, str) and not value.strip()):
          db["settings"][key] = ""
        elif isinstance(value, str):
          db["settings"][key] = value.strip()

    return jsonify({"success": True, "settings": db["settings"]})


@app.route("/api/locations", methods=["GET"])
def get_locations():
    """Return all store branches with their current open/closed status."""
    return jsonify([loc.to_dict() for loc in db["locations"]])


# ---------------------------------------------------------------------------
# Public Menu Route
# ---------------------------------------------------------------------------

@app.route("/api/menu", methods=["GET"])
def get_menu():
    """
    Return all categories with their available products nested inside.
    Categories are sorted by sort_order ascending.

    Each category marks its bestseller (the top-selling item within that
    category, or its first item when there are no sales yet) and sorts it to
    the front. Any playlists belonging to the category are included with their
    resolved product items.
    """
    sales_totals: dict = {}
    for order in db["orders"]:
        for item in order.items:
            pid = item.get("product_id")
            sales_totals[pid] = sales_totals.get(pid, 0) + int(item.get("quantity", 0))

    new_cutoff = datetime.utcnow() - timedelta(days=30)
    newest_product = None
    for product in db["products"]:
        if product.is_available and product.created_at >= new_cutoff:
            if newest_product is None or product.created_at > newest_product.created_at:
                newest_product = product
    new_product_id = newest_product.id if newest_product else None

    products_by_cat: dict = {}
    product_by_id: dict = {}
    for product in db["products"]:
        if product.is_available:
            d = product.to_dict()
            d["is_new"] = product.id == new_product_id
            products_by_cat.setdefault(product.category_id, []).append(d)
            product_by_id[product.id] = d

    menu = []
    for cat in sorted(db["categories"], key=lambda c: c.sort_order):
        cat_products = products_by_cat.get(cat.id, [])

        # Products assigned to any playlist leave the regular grid; they are
        # only visible inside their playlist view.
        playlist_ids = {pid for pl in db["playlists"] for pid in pl.product_ids}
        if playlist_ids:
            cat_products = [p for p in cat_products if p["id"] not in playlist_ids]

        bestseller_id = None
        if cat_products:
            bestseller_id = sorted(
                cat_products,
                key=lambda p: sales_totals.get(p["id"], 0),
                reverse=True,
            )[0]["id"]
            if sales_totals.get(bestseller_id, 0) <= 0:
                bestseller_id = cat_products[0]["id"]

        for d in cat_products:
            d["is_bestseller"] = d["id"] == bestseller_id

        if bestseller_id:
            cat_products.sort(key=lambda p: 0 if p["id"] == bestseller_id else 1)

        cat_dict = cat.to_dict()
        cat_dict["products"] = cat_products
        cat_dict["bestseller_id"] = bestseller_id

        playlists = []
        for pl in sorted(
            (p for p in db["playlists"] if p.category_id == cat.id),
            key=lambda p: p.sort_order,
        ):
            items = [product_by_id[pid] for pid in pl.product_ids if pid in product_by_id]
            pl_dict = pl.to_dict()
            pl_dict["items"] = items
            playlists.append(pl_dict)
        cat_dict["playlists"] = playlists

        menu.append(cat_dict)

    return jsonify(menu)


# ---------------------------------------------------------------------------
# Product Search Route
# ---------------------------------------------------------------------------

@app.route("/api/products/search", methods=["GET"])
def search_products():
    """
    Search products by name or description.

    Query parameter:
        q — search term (case-insensitive substring match)

    Returns a list of matching product dicts (regardless of availability).
    """
    query = request.args.get("q", "").lower().strip()
    if not query:
        return jsonify([])

    results = [
        p.to_dict()
        for p in db["products"]
        if p.is_available and (query in p.name.lower() or query in p.description.lower())
    ]
    return jsonify(results)


# ---------------------------------------------------------------------------
# Frontend Serving (Catch-All)
# ---------------------------------------------------------------------------

FRONTEND_TEMPLATES = os.path.join(os.path.dirname(__file__), "..", "frontend", "templates")
FRONTEND_STATIC = os.path.join(os.path.dirname(__file__), "..", "frontend", "static")


@app.route("/static/<path:filename>")
def serve_static(filename):
    """Serve the vanilla frontend assets and uploaded images."""
    return send_from_directory(FRONTEND_STATIC, filename)


@app.route("/manifest.json")
def serve_manifest():
    """Serve the PWA web app manifest."""
    return send_from_directory(FRONTEND_STATIC, "manifest.json")


@app.route("/sw.js")
def serve_service_worker():
    """Serve the PWA service worker."""
    response = send_from_directory(FRONTEND_STATIC, "sw.js")
    response.headers["Cache-Control"] = "no-cache"
    return response


@app.route("/admin")
def serve_admin():
    """Serve the admin dashboard SPA."""
    return send_from_directory(FRONTEND_TEMPLATES, "admin.html")


@app.route("/track")
def serve_track():
    """Serve the order-tracking page."""
    return send_from_directory(FRONTEND_TEMPLATES, "track.html")


@app.route("/locations")
def serve_branch_locations():
    """Serve the branch locations page."""
    return send_from_directory(FRONTEND_TEMPLATES, "locations.html")


@app.route("/luck")
def serve_luck():
    """Serve the games page."""
    return send_from_directory(FRONTEND_TEMPLATES, "luck.html")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def catch_all(path):
    """
    Catch-all route: any non-API URL falls through to the main SPA entry point.
    API routes are handled by their blueprints before this route is reached.
    """
    # Avoid swallowing actual API misses — let Flask's 404 handle those
    if path.startswith("api/"):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(FRONTEND_TEMPLATES, "index.html")


# ---------------------------------------------------------------------------
# Dev Server Entry Point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app.run(
        debug=os.environ.get("FLASK_DEBUG") == "1",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", "5000")),
    )
