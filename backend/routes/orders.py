"""
routes/orders.py — Orders Blueprint
=====================================
Handles coupon validation, the full checkout flow (discount stacking,
order persistence, loyalty points), order history, and the Yangon
delivery location hierarchy.

Mounted at `/api/orders` in app.py.
"""

from datetime import datetime

from flask import Blueprint, jsonify, request, session

from app import db
from models import Order

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

orders_bp = Blueprint("orders", __name__)


# ---------------------------------------------------------------------------
# Yangon Location Data
# ---------------------------------------------------------------------------

_YANGON_TOWNSHIPS = {
    "Bahan": (["Ward 1", "Ward 2", "Ward 3", "Kandawgyi Ward", "Inya Ward"],
              ["University Ave", "Inya Rd", "Bahan St"]),
    "Kamayut": (["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Ward 5"],
                ["Pyay Rd", "U Wisara Rd", "Insein Rd"]),
    "Latha": (["Ward 1", "Ward 2", "Ward 3", "Zay Ward", "Aung Chan Thar Ward"],
              ["Strand Rd", "Mahabandoola St", "Anawrahta Rd"]),
    "Hlaing": (["Ward 1", "Ward 2", "Ward 3", "Thamine Ward", "Myoma Ward"],
               ["Hlaing St", "Kyaw Thu St", "Canal Rd"]),
    "Thingangyun": (["Ward 1", "Ward 2", "Ward 3", "Ward 4", "Thanlyin Ward"],
                    ["Thanlyin Rd", "New University Ave", "Market St"]),
    "Tamwe": (["Ward 1", "Ward 2", "Ward 3", "Tamwe Market Ward", "Myoma Ward"],
              ["Tamwe Main Rd", "Bogyoke St", "Garden St"]),
    "Yankin": (["Ward 1", "Ward 2", "Ward 3", "Yankin Market Ward", "Royal Ward"],
               ["Yankin Rd", "Royal Rd", "Market Ln"]),
    "Dagon": (["Ward 1", "Ward 2", "Ward 3", "Dagon Market Ward", "Central Ward"],
              ["Pyay Rd", "Dagon St", "Central Ave"]),
}

YANGON_LOCATIONS = {
    "Yangon": {
        "townships": {
            township: {
                "wards": {
                    ward: {"streets": streets}
                    for ward in wards
                }
            }
            for township, (wards, streets) in _YANGON_TOWNSHIPS.items()
        }
    }
}


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@orders_bp.route("/yangon-locations", methods=["GET"])
def get_yangon_locations():
    """
    Return the full hierarchical JSON of Yangon townships, wards, and
    streets used to populate the delivery address form.
    """
    return jsonify(YANGON_LOCATIONS)


@orders_bp.route("/validate-coupon", methods=["POST"])
def validate_coupon():
    """
    Check whether a coupon code is valid and not expired.

    Expected JSON body:
        { "code": "WEEKEND20" }

    Returns:
        200 — { "valid": true,  "discount_pct": 20.0 }
        200 — { "valid": false, "reason": "..." }
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"valid": False, "reason": "Invalid request body"}), 400
    code = str(data.get("code", "")).strip().upper()

    if not code:
        return jsonify({"valid": False, "reason": "No coupon code provided"})

    coupon = next((c for c in db["coupons"] if c.code == code), None)

    if coupon is None:
        return jsonify({"valid": False, "reason": "Coupon code not found"})

    if not coupon.is_active:
        return jsonify({"valid": False, "reason": "This coupon is no longer active"})

    if coupon.expires_at < datetime.utcnow():
        return jsonify({"valid": False, "reason": "This coupon has expired"})

    return jsonify({"valid": True, "code": coupon.code, "discount_pct": coupon.discount_pct})


@orders_bp.route("/checkout", methods=["POST"])
def checkout():
    """
    Process an order and return a full pricing breakdown.

    Expected JSON body:
    {
        "items": [
            { "product_id": "<uuid>", "quantity": 2 }
        ],
        "coupon_code": "WEEKEND20",        // optional
        "address": {
            "city":     "Yangon",
            "township": "Bahan",
            "ward":     "Kandawgyi Ward",
            "street":   "Inya Rd",
            "house":    "No. 42"
        }
    }

    Discount stacking order:
        1. Member discount  — applied to the entire subtotal if logged in
        2. Combo discount   — applied per-item on combo products
        3. Coupon discount  — applied to the post-member-discount subtotal

    All monetary values are integers in MMK.
    """
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    raw_items   = data.get("items", [])
    coupon_code = str(data.get("coupon_code", "")).strip().upper()
    address     = data.get("address", {})

    if not isinstance(raw_items, list) or not raw_items:
        return jsonify({"error": "Order must contain at least one item"}), 400
    if not isinstance(address, dict):
        return jsonify({"error": "A complete delivery address is required"}), 400

    city = address.get("city")
    township = address.get("township")
    ward = address.get("ward")
    street = address.get("street")
    house = str(address.get("house", "")).strip()
    if not all(isinstance(value, str) for value in (city, township, ward, street)):
        return jsonify({"error": "Address fields must be text"}), 400
    if not isinstance(address.get("house"), str):
        return jsonify({"error": "House or room number must be text"}), 400
    city_data = YANGON_LOCATIONS.get(city, {})
    township_data = city_data.get("townships", {}).get(township, {})
    ward_data = township_data.get("wards", {}).get(ward, {})
    if (
        not city or not township or not ward or not street or not house
        or street not in ward_data.get("streets", [])
    ):
        return jsonify({"error": "Select a valid city, township, ward and street, and enter a house or room number"}), 400

    # ------------------------------------------------------------------
    # Step 1 — Resolve products and build line items
    # ------------------------------------------------------------------
    product_lookup = {p.id: p for p in db["products"]}
    line_items     = []

    for entry in raw_items:
        if not isinstance(entry, dict):
            return jsonify({"error": "Each order item must be an object"}), 400
        pid = str(entry.get("product_id", ""))
        try:
            quantity = int(entry.get("quantity", 1))
        except (TypeError, ValueError):
            return jsonify({"error": "Quantity must be a whole number"}), 400

        product = product_lookup.get(pid)
        if product is None:
            return jsonify({"error": f"Product '{pid}' not found"}), 404
        if not product.is_available:
            return jsonify({"error": f"'{product.name}' is currently unavailable"}), 400
        if quantity < 1:
            return jsonify({"error": "Quantity must be at least 1"}), 400
        if quantity > 99:
            return jsonify({"error": "Quantity cannot exceed 99 per product"}), 400

        item_subtotal = product.price * quantity
        line_items.append({
            "product_id":        product.id,
            "name":              product.name,
            "unit_price":        product.price,
            "quantity":          quantity,
            "subtotal":          item_subtotal,
            "is_combo":          product.is_combo,
            "combo_discount_pct": product.combo_discount_pct,
            "combo_savings":     0,  # filled in below
        })

    # ------------------------------------------------------------------
    # Step 2 — Raw subtotal (no discounts)
    # ------------------------------------------------------------------
    subtotal: int = sum(item["subtotal"] for item in line_items)

    # ------------------------------------------------------------------
    # Step 3 — Member discount (logged-in users only)
    # ------------------------------------------------------------------
    user_id = session.get("user_id")
    if not any(user.id == user_id for user in db["users"]):
        user_id = None
    member_discount: int = 0

    if user_id and any(u.id == user_id for u in db["users"]):
        member_discount_pct = db["settings"].get("member_discount_pct", 0.0)
        for item in line_items:
            item["member_savings"] = int(item["subtotal"] * (member_discount_pct / 100))
        member_discount = sum(item["member_savings"] for item in line_items)

    # ------------------------------------------------------------------
    # Step 4 — Combo discounts (per line item)
    # ------------------------------------------------------------------
    combo_savings: int = 0

    for item in line_items:
        if item["is_combo"] and item["combo_discount_pct"] > 0:
            discount_base = item["subtotal"] - item.get("member_savings", 0)
            saving = int(discount_base * (item["combo_discount_pct"] / 100))
            item["combo_savings"] = saving
            combo_savings        += saving

    # ------------------------------------------------------------------
    # Step 5 — Coupon discount (applied after member discount)
    # ------------------------------------------------------------------
    coupon_savings: int   = 0
    coupon_applied: str   = ""
    coupon_pct:     float = 0.0

    if coupon_code:
        coupon = next((c for c in db["coupons"] if c.code == coupon_code), None)

        if coupon is None:
            return jsonify({"error": f"Coupon '{coupon_code}' not found"}), 400

        if not coupon.is_active:
            return jsonify({"error": "Coupon is no longer active"}), 400

        if coupon.expires_at < datetime.utcnow():
            return jsonify({"error": "Coupon has expired"}), 400

        # Apply coupon on subtotal net of member discount
        post_member_subtotal = max(0, subtotal - member_discount - combo_savings)
        coupon_savings       = int(post_member_subtotal * (coupon.discount_pct / 100))
        coupon_applied       = coupon.code
        coupon_pct           = coupon.discount_pct

    # ------------------------------------------------------------------
    # Step 6 — Final total
    # ------------------------------------------------------------------
    total_discount: int = member_discount + combo_savings + coupon_savings
    total:          int = max(0, subtotal - total_discount)

    # ------------------------------------------------------------------
    # Step 7 — Persist the order and award loyalty points
    # ------------------------------------------------------------------
    new_order = Order(
        user_id=user_id,
        items=line_items,
        subtotal=subtotal,
        discount_amount=total_discount,
        total=total,
        address=address,
        coupon_code=coupon_applied,
        status="pending",
    )
    db["orders"].append(new_order)

    points_earned = 0
    points_balance = None

    # Award 100 loyalty points per order for logged-in members
    if user_id:
        user = next((u for u in db["users"] if u.id == user_id), None)
        if user:
            points_earned = 100
            user.points += points_earned
            points_balance = user.points

    # ------------------------------------------------------------------
    # Return full summary
    # ------------------------------------------------------------------
    return jsonify({
        "success": True,
        "order": new_order.to_dict(),
        "loyalty": {
            "points_earned": points_earned,
            "points_balance": points_balance,
        },
        "breakdown": {
            "subtotal":          subtotal,
            "member_discount":   member_discount,
            "combo_savings":     combo_savings,
            "coupon_code":       coupon_applied,
            "coupon_pct":        coupon_pct,
            "coupon_savings":    coupon_savings,
            "total_discount":    total_discount,
            "total":             total,
        },
    })


@orders_bp.route("/history", methods=["GET"])
def order_history():
    """
    Return the order history for the currently logged-in user.
    Returns an empty list for unauthenticated (guest) users.
    """
    user_id = session.get("user_id")
    if not user_id:
        return jsonify([])

    user_orders = [
        o.to_dict()
        for o in sorted(db["orders"], key=lambda o: o.created_at, reverse=True)
        if o.user_id == user_id
    ]
    return jsonify(user_orders)
