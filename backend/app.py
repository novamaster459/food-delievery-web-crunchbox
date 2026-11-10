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
import re
import sys
from datetime import datetime

from flask import Flask, jsonify, request, send_from_directory, session
from flask_cors import CORS
from werkzeug.security import generate_password_hash

from models import Category, Coupon, Order, Product, User

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
    "settings": {
        "shop_name": "CrunchBox",
        "logo_filename": "",
        "member_discount_pct": 10.0,   # % discount for logged-in members
        "combo_discount_pct": 15.0,    # Default % discount for combo products
        "reward_iced_cola_points": 2000,
        "reward_spicy_crunch_burger_points": 8000,
        "reward_crispy_chicken_bucket_points": 20000,
        "accent_color": "#ff6b00",
        "background_color": "#121212",
        "hero_heading": "Crispy Flavor,\nDelivered Fast.",
        "hero_subtext": "Hot, crunchy & made fresh for you.",
        "hero_image_filename": "",
        "featured_title": "Chef Specials",
        "featured_text": "Made with love by our chefs — unique recipes you won't find anywhere else.",
        "featured_image_filename": "",
        "deal_title": "Weekend Crunch Fest",
        "deal_text": "Up to 25% OFF on selected items. Limited time only!",
        "deal_button_text": "Order Now",
        "deal_image_filename": "",
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
    # Categories
    # ------------------------------------------------------------------
    cat_mains      = Category(name="Mains",             icon="🍗", sort_order=1)
    cat_drinks     = Category(name="Drinks",            icon="🥤", sort_order=2)
    cat_appetizers = Category(name="Appetizers",        icon="🍟", sort_order=3)
    cat_desserts   = Category(name="Desserts",          icon="🍰", sort_order=4)
    cat_combos     = Category(name="Special Combo Sets",icon="🎁", sort_order=5)

    db["categories"].extend([cat_mains, cat_drinks, cat_appetizers, cat_desserts, cat_combos])

    # ------------------------------------------------------------------
    # Products — Mains
    # ------------------------------------------------------------------
    db["products"].extend([
        Product(
            category_id=cat_mains.id,
            name="Crispy Chicken Bucket",
            description="A generous bucket of golden, perfectly seasoned crispy fried chicken pieces.",
            price=25000,
        ),
        Product(
            category_id=cat_mains.id,
            name="Spicy Crunch Burger",
            description="Juicy chicken patty with sriracha slaw and pickles on a toasted brioche bun.",
            price=9500,
        ),
        Product(
            category_id=cat_mains.id,
            name="Korean BBQ Wings",
            description="Sticky Korean-style BBQ glaze on crispy chicken wings, served with ranch dip.",
            price=12000,
        ),
        Product(
            category_id=cat_mains.id,
            name="Grilled Chicken Sandwich",
            description="Tender grilled chicken breast with lettuce, tomato and honey mustard on ciabatta.",
            price=8500,
        ),
    ])

    # ------------------------------------------------------------------
    # Products — Drinks
    # ------------------------------------------------------------------
    db["products"].extend([
        Product(category_id=cat_drinks.id, name="Fresh Lime Soda",  description="Hand-squeezed lime with sparkling water and mint.",          price=3500),
        Product(category_id=cat_drinks.id, name="Iced Cola",        description="Ice-cold cola served over crushed ice.",                     price=2500),
        Product(category_id=cat_drinks.id, name="Mango Lassi",      description="Creamy blended mango and yoghurt smoothie.",                 price=4000),
        Product(category_id=cat_drinks.id, name="Lemon Iced Tea",   description="Brewed black tea chilled with fresh lemon slices.",          price=3000),
    ])

    # ------------------------------------------------------------------
    # Products — Appetizers
    # ------------------------------------------------------------------
    db["products"].extend([
        Product(category_id=cat_appetizers.id, name="Golden Fries",       description="Crispy shoestring fries seasoned with sea salt.",         price=4500),
        Product(category_id=cat_appetizers.id, name="Chicken Tenders",    description="Juicy strips of breaded chicken served with dipping sauce.",price=7000),
        Product(category_id=cat_appetizers.id, name="Onion Rings",        description="Thick-cut onion rings in a light, crispy beer batter.",    price=3500),
        Product(category_id=cat_appetizers.id, name="Mozzarella Sticks",  description="Stretchy mozzarella encased in crunchy golden breadcrumbs.",price=5500),
    ])

    # ------------------------------------------------------------------
    # Products — Desserts
    # ------------------------------------------------------------------
    db["products"].extend([
        Product(category_id=cat_desserts.id, name="Chocolate Lava Cake", description="Warm chocolate cake with a molten fudge centre.",         price=6000),
        Product(category_id=cat_desserts.id, name="Ice Cream Scoops",    description="Two scoops of your choice: vanilla, chocolate or strawberry.",price=4000),
        Product(category_id=cat_desserts.id, name="Cheesecake Slice",    description="Classic New York-style cheesecake with berry compote.",     price=5500),
        Product(category_id=cat_desserts.id, name="Brownie Sundae",      description="Fudgy brownie topped with ice cream and hot fudge sauce.",  price=4500),
    ])

    # ------------------------------------------------------------------
    # Products — Special Combo Sets
    # ------------------------------------------------------------------
    db["products"].extend([
        Product(
            category_id=cat_combos.id,
            name="Family Crunch Bundle",
            description="Bucket of 12 crispy pieces, 2 large fries, 4 drinks and dipping sauces. Perfect for the whole family!",
            price=45000,
            is_combo=True,
            combo_discount_pct=15.0,
        ),
        Product(
            category_id=cat_combos.id,
            name="Party Pack",
            description="20 wings, 10 tenders, 2 large fries and 6 sodas. The ultimate party spread.",
            price=38000,
            is_combo=True,
            combo_discount_pct=15.0,
        ),
        Product(
            category_id=cat_combos.id,
            name="Date Night Set",
            description="2 burgers, 1 large fries, 2 specialty drinks and a dessert to share.",
            price=22000,
            is_combo=True,
            combo_discount_pct=15.0,
        ),
    ])

    # ------------------------------------------------------------------
    # Coupons
    # ------------------------------------------------------------------
    db["coupons"].extend([
        Coupon(
            code="WEEKEND20",
            discount_pct=20.0,
            expires_at=datetime(2027, 12, 31, 23, 59, 59),
            is_active=True,
        ),
        Coupon(
            code="SETBONUS",
            discount_pct=25.0,
            expires_at=datetime(2027, 6, 30, 23, 59, 59),
            is_active=True,
        ),
    ])

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

app.register_blueprint(auth_bp,   url_prefix="/api/auth")
app.register_blueprint(admin_bp,  url_prefix="/api/admin")
app.register_blueprint(orders_bp, url_prefix="/api/orders")


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

    return jsonify({"success": True, "settings": db["settings"]})


# ---------------------------------------------------------------------------
# Public Menu Route
# ---------------------------------------------------------------------------

@app.route("/api/menu", methods=["GET"])
def get_menu():
    """
    Return all categories with their available products nested inside.
    Categories are sorted by sort_order ascending.
    """
    # Build a lookup: category_id → list of available product dicts
    products_by_cat: dict = {}
    for product in db["products"]:
        if product.is_available:
            products_by_cat.setdefault(product.category_id, []).append(product.to_dict())

    # Assemble the response
    menu = []
    for cat in sorted(db["categories"], key=lambda c: c.sort_order):
        cat_dict = cat.to_dict()
        cat_dict["products"] = products_by_cat.get(cat.id, [])
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


@app.route("/admin")
def serve_admin():
    """Serve the admin dashboard SPA."""
    return send_from_directory(FRONTEND_TEMPLATES, "admin.html")


@app.route("/track")
def serve_track():
    """Serve the order-tracking page."""
    return send_from_directory(FRONTEND_TEMPLATES, "track.html")


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
