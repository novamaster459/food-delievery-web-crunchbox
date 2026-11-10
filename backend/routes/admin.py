"""
routes/admin.py — Admin Blueprint
==================================
Provides CRUD endpoints for categories, products, coupons, and order
management.  All mutating operations are gated behind the `@require_admin`
decorator which verifies that the caller holds an active admin session.

Mounted at `/api/admin` in app.py.
"""

import os
import re
import uuid
from datetime import datetime, timezone
from functools import wraps

from flask import Blueprint, current_app, jsonify, request, session
from werkzeug.utils import secure_filename

from app import db
from models import BranchLocation, Category, Coupon, Product

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

admin_bp = Blueprint("admin", __name__)

# File extensions allowed for image uploads
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _allowed_file(filename: str) -> bool:
    """Return True if the filename carries an allowed image extension."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


def _save_image(file_storage) -> str:
    """
    Persist an uploaded image to UPLOAD_FOLDER.

    Prefixes the filename with a UUID segment to prevent collisions and to
    ensure filenames are URL-safe.

    Returns the sanitised filename (not the full path).
    """
    original_name = secure_filename(file_storage.filename)
    if not original_name:
        raise ValueError("The uploaded image must have a valid filename")
    unique_name   = f"{uuid.uuid4().hex}_{original_name}"
    save_path     = os.path.join(current_app.config["UPLOAD_FOLDER"], unique_name)
    file_storage.save(save_path)
    return unique_name


def require_admin(f):
    """
    Decorator that aborts with 403 Forbidden if the current session does not
    have the `is_admin` flag set.  Apply this to any admin-only endpoint.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get("is_admin"):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


# ---------------------------------------------------------------------------
# Category Routes
# ---------------------------------------------------------------------------

@admin_bp.route("/categories", methods=["GET"])
def list_categories():
    """Return all categories sorted by sort_order."""
    cats = sorted(db["categories"], key=lambda c: c.sort_order)
    return jsonify([c.to_dict() for c in cats])


@admin_bp.route("/categories", methods=["POST"])
@require_admin
def add_category():
    """
    Create a new category.

    Expected JSON body:
        { "name": "...", "icon": "🍕" }
    """
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    icon = str(data.get("icon", "")).strip()

    if not name:
        return jsonify({"error": "Category name is required"}), 400

    # sort_order defaults to one more than the current maximum
    max_order = max((c.sort_order for c in db["categories"]), default=0)
    new_cat   = Category(name=name, icon=icon, sort_order=max_order + 1)
    db["categories"].append(new_cat)

    return jsonify({"success": True, "category": new_cat.to_dict()}), 201


@admin_bp.route("/categories/<cat_id>", methods=["PUT"])
@require_admin
def edit_category(cat_id: str):
    """
    Update a category's name and/or icon.

    Expected JSON body (all fields optional):
        { "name": "...", "icon": "🍕" }
    """
    cat = next((c for c in db["categories"] if c.id == cat_id), None)
    if cat is None:
        return jsonify({"error": "Category not found"}), 404

    data = request.get_json(silent=True) or {}

    if "name" in data:
        cat.name = str(data["name"]).strip()
    if "icon" in data:
        cat.icon = str(data["icon"]).strip()

    return jsonify({"success": True, "category": cat.to_dict()})


@admin_bp.route("/categories/<cat_id>", methods=["DELETE"])
@require_admin
def delete_category(cat_id: str):
    """
    Delete a category and cascade-delete all products that belong to it.
    """
    cat = next((c for c in db["categories"] if c.id == cat_id), None)
    if cat is None:
        return jsonify({"error": "Category not found"}), 404

    # Cascade: remove all products in this category
    db["products"] = [p for p in db["products"] if p.category_id != cat_id]
    db["categories"].remove(cat)

    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# Product Routes
# ---------------------------------------------------------------------------

@admin_bp.route("/products", methods=["GET"])
def list_products():
    """
    Return all products enriched with their parent category name and icon.
    """
    cat_lookup = {c.id: c for c in db["categories"]}
    result = []
    for p in db["products"]:
        d = p.to_dict()
        cat = cat_lookup.get(p.category_id)
        d["category_name"] = cat.name if cat else ""
        d["category_icon"] = cat.icon if cat else ""
        result.append(d)
    return jsonify(result)


@admin_bp.route("/products", methods=["POST"])
@require_admin
def add_product():
    """
    Create a new product.  Accepts multipart/form-data.

    Form fields:
        category_id    (str, required)
        name           (str, required)
        description    (str)
        price          (int, MMK)
        is_combo       (bool as 'true'/'false' string)
        combo_discount_pct (float)
        image          (file, optional)
    """
    form = request.form

    category_id = form.get("category_id", "").strip()
    name        = form.get("name", "").strip()

    if not category_id or not name:
        return jsonify({"error": "category_id and name are required"}), 400

    # Verify the category exists
    if not any(c.id == category_id for c in db["categories"]):
        return jsonify({"error": "Category not found"}), 404

    # Parse numeric/boolean fields safely
    try:
        price = int(form.get("price", 0))
        if price <= 0:
            raise ValueError
    except ValueError:
        return jsonify({"error": "Price must be a positive whole number of MMK"}), 400

    try:
        combo_discount_pct = float(form.get("combo_discount_pct", 0.0))
    except ValueError:
        return jsonify({"error": "Combo discount must be a number"}), 400
    if not 0 <= combo_discount_pct <= 100:
        return jsonify({"error": "Combo discount must be between 0 and 100"}), 400

    is_combo = form.get("is_combo", "false").lower() == "true"
    try:
        loyalty_points = int(form.get("loyalty_points", 100))
    except ValueError:
        return jsonify({"error": "Points per item must be a whole number"}), 400
    if not 0 <= loyalty_points <= 1_000_000:
        return jsonify({"error": "Points per item must be between 0 and 1,000,000"}), 400

    is_reward = form.get("is_reward", "false").lower() == "true"
    try:
        reward_points = int(form.get("reward_points", 0) or 0)
    except ValueError:
        return jsonify({"error": "Reward points must be a whole number"}), 400
    if not 0 <= reward_points <= 1_000_000:
        return jsonify({"error": "Reward points must be between 0 and 1,000,000"}), 400
    if is_reward and reward_points < 1:
        return jsonify({"error": "Set how many points this reward costs"}), 400
    if is_reward and is_combo:
        return jsonify({"error": "Combo sets cannot be point rewards"}), 400

    # Handle optional image upload
    image_filename = ""
    image_file     = request.files.get("image")
    if image_file and image_file.filename:
        if not _allowed_file(image_file.filename):
            return jsonify({"error": "Invalid image type. Allowed: png, jpg, jpeg, gif, webp"}), 400
        image_filename = _save_image(image_file)

    new_product = Product(
        category_id=category_id,
        name=name,
        description=form.get("description", "").strip(),
        price=price,
        image_filename=image_filename,
        is_combo=is_combo,
        combo_discount_pct=combo_discount_pct,
        loyalty_points=loyalty_points,
        is_reward=is_reward,
        reward_points=reward_points,
    )
    db["products"].append(new_product)

    return jsonify({"success": True, "product": new_product.to_dict()}), 201


@admin_bp.route("/products/<prod_id>", methods=["PUT"])
@require_admin
def edit_product(prod_id: str):
    """
    Update an existing product.  Accepts multipart/form-data.
    Only fields present in the form are updated (partial update semantics).
    """
    product = next((p for p in db["products"] if p.id == prod_id), None)
    if product is None:
        return jsonify({"error": "Product not found"}), 404

    form = request.form

    if "category_id" in form:
        new_cat_id = form["category_id"].strip()
        if not any(c.id == new_cat_id for c in db["categories"]):
            return jsonify({"error": "Category not found"}), 404
        product.category_id = new_cat_id

    if "name" in form:
        product.name = form["name"].strip()
    if "description" in form:
        product.description = form["description"].strip()
    if "price" in form:
        try:
            price = int(form["price"])
            if price <= 0:
                raise ValueError
        except ValueError:
            return jsonify({"error": "Price must be a positive whole number of MMK"}), 400
        product.price = price
    if "is_combo" in form:
        product.is_combo = form["is_combo"].lower() == "true"
    if "loyalty_points" in form:
        try:
            loyalty_points = int(form["loyalty_points"])
        except ValueError:
            return jsonify({"error": "Points per item must be a whole number"}), 400
        if not 0 <= loyalty_points <= 1_000_000:
            return jsonify({"error": "Points per item must be between 0 and 1,000,000"}), 400
        product.loyalty_points = loyalty_points
    if "is_reward" in form:
        product.is_reward = form["is_reward"].lower() == "true"
    if "reward_points" in form:
        try:
            reward_points = int(form["reward_points"] or 0)
        except ValueError:
            return jsonify({"error": "Reward points must be a whole number"}), 400
        if not 0 <= reward_points <= 1_000_000:
            return jsonify({"error": "Reward points must be between 0 and 1,000,000"}), 400
        product.reward_points = reward_points
    if product.is_reward and product.reward_points < 1:
        return jsonify({"error": "Set how many points this reward costs"}), 400
    if product.is_reward and product.is_combo:
        return jsonify({"error": "Combo sets cannot be point rewards"}), 400
    if "combo_discount_pct" in form:
        try:
            discount = float(form["combo_discount_pct"])
        except ValueError:
            return jsonify({"error": "Combo discount must be a number"}), 400
        if not 0 <= discount <= 100:
            return jsonify({"error": "Combo discount must be between 0 and 100"}), 400
        product.combo_discount_pct = discount
    if "is_available" in form:
        is_available = form["is_available"].lower() == "true"
        if not is_available and any(
            coupon.is_active
            and coupon.reward_product_id == prod_id
            and coupon.expires_at >= datetime.utcnow()
            for coupon in db["coupons"]
        ):
            return jsonify({"error": "This product has an unexpired member reward voucher and cannot be disabled yet"}), 409
        product.is_available = is_available

    # Replace image if a new one is uploaded
    image_file = request.files.get("image")
    if image_file and image_file.filename and _allowed_file(image_file.filename):
        product.image_filename = _save_image(image_file)
    elif image_file and image_file.filename:
        return jsonify({"error": "Invalid image type. Allowed: png, jpg, jpeg, gif, webp"}), 400

    return jsonify({"success": True, "product": product.to_dict()})


@admin_bp.route("/products/<prod_id>", methods=["DELETE"])
@require_admin
def delete_product(prod_id: str):
    """Remove a product from the catalogue."""
    product = next((p for p in db["products"] if p.id == prod_id), None)
    if product is None:
        return jsonify({"error": "Product not found"}), 404

    if any(
        coupon.is_active and coupon.reward_product_id == prod_id
        for coupon in db["coupons"]
    ):
        return jsonify({"error": "This product has an unexpired member reward voucher and cannot be deleted yet"}), 409

    db["products"].remove(product)
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# Coupon Routes
# ---------------------------------------------------------------------------

@admin_bp.route("/coupons", methods=["GET"])
@require_admin
def list_coupons():
    """Return all coupons."""
    return jsonify([c.to_dict() for c in db["coupons"]])


@admin_bp.route("/coupons", methods=["POST"])
@require_admin
def add_coupon():
    """
    Create a new coupon code.

    Expected JSON body:
        {
          "code": "SAVE10",
          "discount_pct": 10.0,
          "expires_at": "2027-12-31"   // ISO date string
        }
    """
    data = request.get_json(silent=True) or {}

    code         = str(data.get("code", "")).strip().upper()
    try:
        discount_pct = float(data.get("discount_pct", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "discount_pct must be a number"}), 400
    expires_at_s = str(data.get("expires_at", ""))

    if not code:
        return jsonify({"error": "Coupon code is required"}), 400
    if not 0 < discount_pct <= 100:
        return jsonify({"error": "Coupon discount must be greater than 0 and no more than 100"}), 400
    is_active = data.get("is_active", True)
    if not isinstance(is_active, bool):
        return jsonify({"error": "is_active must be a boolean"}), 400

    # Duplicate code check
    if any(c.code == code for c in db["coupons"]):
        return jsonify({"error": "A coupon with that code already exists"}), 400

    # Parse expiry date
    try:
        expires_at = datetime.fromisoformat(expires_at_s)
    except ValueError:
        return jsonify({"error": "expires_at must be an ISO date string (YYYY-MM-DD)"}), 400
    if expires_at.tzinfo is not None:
        expires_at = expires_at.astimezone(timezone.utc).replace(tzinfo=None)
    if len(expires_at_s) == 10:
        expires_at = expires_at.replace(hour=23, minute=59, second=59)
    if expires_at <= datetime.utcnow():
        return jsonify({"error": "Coupon expiration must be in the future"}), 400

    new_coupon = Coupon(
        code=code,
        discount_pct=discount_pct,
        expires_at=expires_at,
        is_active=is_active,
    )
    db["coupons"].append(new_coupon)

    return jsonify({"success": True, "coupon": new_coupon.to_dict()}), 201


@admin_bp.route("/coupons/<coupon_id>", methods=["DELETE"])
@require_admin
def delete_coupon(coupon_id: str):
    """Remove a coupon by ID."""
    coupon = next((c for c in db["coupons"] if c.id == coupon_id), None)
    if coupon is None:
        return jsonify({"error": "Coupon not found"}), 404

    db["coupons"].remove(coupon)
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# Branch Location Routes
# ---------------------------------------------------------------------------

_HHMM_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


def _parse_location_payload(data: dict, partial: bool = False):
    """
    Validate a location payload.

    Returns (error_message, fields_dict).  `fields_dict` only contains the
    keys present (and valid) in the request; on error it is empty.
    """
    fields = {}

    if "name" in data or not partial:
        name = str(data.get("name", "")).strip()
        if not name or len(name) > 80:
            return "Location name must be between 1 and 80 characters", {}
        fields["name"] = name

    if "branch_no" in data or not partial:
        branch_no = str(data.get("branch_no", "")).strip()
        if not branch_no or len(branch_no) > 20:
            return "Branch number must be between 1 and 20 characters", {}
        fields["branch_no"] = branch_no

    if "open_time" in data or not partial:
        open_time = str(data.get("open_time", "")).strip()
        if not _HHMM_RE.match(open_time):
            return "Opening time must be in HH:MM (24-hour) format", {}
        fields["open_time"] = open_time
    if "close_time" in data or not partial:
        close_time = str(data.get("close_time", "")).strip()
        if not _HHMM_RE.match(close_time):
            return "Closing time must be in HH:MM (24-hour) format", {}
        fields["close_time"] = close_time

    return None, fields


@admin_bp.route("/locations", methods=["GET"])
@require_admin
def list_locations():
    """Return all branch locations with their current open/closed status."""
    return jsonify([loc.to_dict() for loc in db["locations"]])


@admin_bp.route("/locations", methods=["POST"])
@require_admin
def add_location():
    """
    Create a new branch location.  Accepts multipart/form-data.

    Form fields:
        name        (str, required)
        branch_no   (str, required)
        open_time   (str "HH:MM", required)
        close_time  (str "HH:MM", required)
        image       (file, optional)
    """
    form = request.form

    error, fields = _parse_location_payload(form)
    if error:
        return jsonify({"error": error}), 400
    if fields["open_time"] == fields["close_time"]:
        return jsonify({"error": "Opening and closing times must differ"}), 400

    if any(loc.branch_no == fields["branch_no"] for loc in db["locations"]):
        return jsonify({"error": f"Branch number {fields['branch_no']} is already in use"}), 400

    image_file = request.files.get("image")
    if image_file and image_file.filename:
        if not _allowed_file(image_file.filename):
            return jsonify({"error": "Invalid image type. Allowed: png, jpg, jpeg, gif, webp"}), 400
        fields["image_filename"] = _save_image(image_file)

    new_location = BranchLocation(**fields)
    db["locations"].append(new_location)
    return jsonify({"success": True, "location": new_location.to_dict()}), 201


@admin_bp.route("/locations/<loc_id>", methods=["PUT"])
@require_admin
def edit_location(loc_id: str):
    """Update an existing branch location (partial update semantics)."""
    location = next((loc for loc in db["locations"] if loc.id == loc_id), None)
    if location is None:
        return jsonify({"error": "Location not found"}), 404

    form = request.form

    if "name" in form:
        name = form["name"].strip()
        if not name or len(name) > 80:
            return jsonify({"error": "Location name must be between 1 and 80 characters"}), 400
        location.name = name
    if "branch_no" in form:
        branch_no = form["branch_no"].strip()
        if not branch_no or len(branch_no) > 20:
            return jsonify({"error": "Branch number must be between 1 and 20 characters"}), 400
        if any(loc.branch_no == branch_no and loc.id != loc_id for loc in db["locations"]):
            return jsonify({"error": f"Branch number {branch_no} is already in use"}), 400
        location.branch_no = branch_no
    if "open_time" in form:
        open_time = form["open_time"].strip()
        if not _HHMM_RE.match(open_time):
            return jsonify({"error": "Opening time must be in HH:MM (24-hour) format"}), 400
        location.open_time = open_time
    if "close_time" in form:
        close_time = form["close_time"].strip()
        if not _HHMM_RE.match(close_time):
            return jsonify({"error": "Closing time must be in HH:MM (24-hour) format"}), 400
        location.close_time = close_time

    if location.open_time == location.close_time:
        return jsonify({"error": "Opening and closing times must differ"}), 400

    # Replace photo if a new one is uploaded
    image_file = request.files.get("image")
    if image_file and image_file.filename and _allowed_file(image_file.filename):
        location.image_filename = _save_image(image_file)
    elif image_file and image_file.filename:
        return jsonify({"error": "Invalid image type. Allowed: png, jpg, jpeg, gif, webp"}), 400

    return jsonify({"success": True, "location": location.to_dict()})


@admin_bp.route("/locations/<loc_id>", methods=["DELETE"])
@require_admin
def delete_location(loc_id: str):
    """Remove a branch location by ID."""
    location = next((loc for loc in db["locations"] if loc.id == loc_id), None)
    if location is None:
        return jsonify({"error": "Location not found"}), 404

    db["locations"].remove(location)
    return jsonify({"success": True})


# ---------------------------------------------------------------------------
# Logo Upload Route
# ---------------------------------------------------------------------------

@admin_bp.route("/upload-logo", methods=["POST"])
@require_admin
def upload_logo():
    """
    Upload a new shop logo.

    Accepts a single file field named `logo`.  Saves the file to UPLOAD_FOLDER
    and updates `db['settings']['logo_filename']`.
    """
    logo_file = request.files.get("logo")
    if not logo_file or not logo_file.filename:
        return jsonify({"error": "No logo file provided"}), 400

    if not _allowed_file(logo_file.filename):
        return jsonify({"error": "Invalid file type. Allowed: png, jpg, jpeg, gif, webp"}), 400

    filename = _save_image(logo_file)
    db["settings"]["logo_filename"] = filename

    return jsonify({
        "success": True,
        "logo_filename": filename,
        "logo_url": f"/static/uploads/{filename}",
    })


@admin_bp.route("/upload-decoration/<kind>", methods=["POST"])
@require_admin
def upload_decoration(kind: str):
    """Upload a storefront hero or promotional banner image."""
    setting_keys = {
        "hero": "hero_image_filename",
        "featured": "featured_image_filename",
        "deal": "deal_image_filename",
    }
    setting_key = setting_keys.get(kind)
    if not setting_key:
        return jsonify({"error": "Unknown decoration image slot"}), 404

    image = request.files.get("image")
    if not image or not image.filename:
        return jsonify({"error": "Choose an image file to upload"}), 400
    if not _allowed_file(image.filename):
        return jsonify({"error": "Invalid image type. Allowed: png, jpg, jpeg, gif, webp"}), 400

    filename = _save_image(image)
    db["settings"][setting_key] = filename
    return jsonify({
        "success": True,
        "filename": filename,
        "image_url": f"/static/uploads/{filename}",
    })


# ---------------------------------------------------------------------------
# Orders (Admin View)
# ---------------------------------------------------------------------------

@admin_bp.route("/orders", methods=["GET"])
@require_admin
def list_orders():
    """
    Return all orders in reverse chronological order (most recent first).
    Includes the customer username when the order is linked to a user account.
    """
    user_lookup = {u.id: u.username for u in db["users"]}
    result = []
    for order in sorted(db["orders"], key=lambda o: o.created_at, reverse=True):
        d = order.to_dict()
        d["username"] = user_lookup.get(order.user_id, "Guest")
        result.append(d)
    return jsonify(result)
