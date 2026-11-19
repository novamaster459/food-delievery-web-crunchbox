"""
routes/auth.py — Authentication Blueprint
==========================================
Handles user registration, login, logout, profile retrieval, and profile
updates.  All routes are mounted under the `/api/auth` prefix defined in
app.py.

The shared `db` dict is imported from app.py and mutated in place so that
changes are immediately visible across all blueprints.
"""

import secrets
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from models import Coupon, User

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

auth_bp = Blueprint("auth", __name__)

REWARD_CATALOG = (
    {"id": "iced-cola", "product_name": "Iced Cola", "settings_key": "reward_iced_cola_points"},
    {"id": "spicy-crunch-burger", "product_name": "Spicy Crunch Burger", "settings_key": "reward_spicy_crunch_burger_points"},
    {"id": "crispy-chicken-bucket", "product_name": "Crispy Chicken Bucket", "settings_key": "reward_crispy_chicken_bucket_points"},
)


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def current_user() -> User | None:
    """
    Retrieve the User object for the currently authenticated session.

    Returns None if no user is logged in or if the stored user_id no longer
    exists in the database (e.g. after a server restart with fresh in-memory
    state).
    """
    user_id = session.get("user_id")
    if not user_id:
        return None
    return next((u for u in db["users"] if u.id == user_id), None)


def reward_options() -> list[dict]:
    """
    Build the redeemable reward catalog from products the admin marked as
    rewards.  Falls back to the original three rewards when no product has
    been configured yet (e.g. an older in-memory data set).
    """
    options = [
        {
            "id": product.id,
            "points_cost": int(product.reward_points),
            "product": product.to_dict(),
        }
        for product in db["products"]
        if product.is_reward and product.is_available and not product.is_combo
    ]
    if options:
        return options

    products_by_name = {
        product.name: product
        for product in db["products"]
        if product.is_available
    }
    for reward in REWARD_CATALOG:
        product = products_by_name.get(reward["product_name"])
        if product is not None:
            options.append({
                "id": reward["id"],
                "points_cost": db["settings"][reward["settings_key"]],
                "product": product.to_dict(),
            })
    return options


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Register a new user account.

    Expected JSON body:
        { "username": "...", "email": "...", "password": "..." }

    Returns:
        201 — { "success": true, "user": {...} }
        400 — { "error": "..." }  on validation failure
    """
    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip()
    email    = str(data.get("email",    "")).strip().lower()
    password = str(data.get("password", "")).strip()

    # --- Basic validation ---------------------------------------------------
    if not username or not email or not password:
        return jsonify({"error": "username, email and password are all required"}), 400

    if len(password) < 6:
        return jsonify({"error": "Password must be at least 6 characters"}), 400

    # --- Uniqueness checks --------------------------------------------------
    if any(u.email == email for u in db["users"]):
        return jsonify({"error": "An account with that email already exists"}), 400

    if any(u.username.lower() == username.lower() for u in db["users"]):
        return jsonify({"error": "That username is already taken"}), 400

    # --- Create user --------------------------------------------------------
    new_user = User(
        username=username,
        email=email,
        password_hash=generate_password_hash(password),
        is_admin=False,
    )
    db["users"].append(new_user)

    return jsonify({"success": True, "user": new_user.to_dict()}), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    Authenticate a user and open a session.

    Expected JSON body:
        { "email": "...", "password": "..." }

    Returns:
        200 — user dict (password_hash excluded) on success
        401 — { "error": "..." } on failure
    """
    data = request.get_json(silent=True) or {}

    email    = str(data.get("email",    "")).strip().lower()
    password = str(data.get("password", "")).strip()

    # Find the user by email
    user = next((u for u in db["users"] if u.email == email), None)

    if user is None or not check_password_hash(user.password_hash, password):
        return jsonify({"error": "Invalid email or password"}), 401

    # Persist authentication in the Flask session (server-side cookie)
    session["user_id"]  = user.id
    session["is_admin"] = user.is_admin

    return jsonify({"success": True, "user": user.to_dict()})


@auth_bp.route("/logout", methods=["POST"])
def logout():
    """
    End the current user session.

    Returns:
        200 — { "success": true }
    """
    session.clear()
    return jsonify({"success": True})


@auth_bp.route("/me", methods=["GET"])
def me():
    """
    Return the profile of the currently logged-in user.

    Returns:
        200 — { "logged_in": true,  "user": {...} }   when authenticated
        200 — { "logged_in": false }                   when no session exists
    """
    user = current_user()
    if user is None:
        return jsonify({"logged_in": False})
    return jsonify({"logged_in": True, "user": user.to_dict()})


@auth_bp.route("/rewards", methods=["GET"])
def rewards():
    """Return the reward catalog and the signed-in member's unspent vouchers."""
    user = current_user()
    if user is None:
        return jsonify({"error": "Log in to view and redeem rewards"}), 401

    catalog = reward_options()

    active_rewards = []
    for coupon in db["coupons"]:
        if (
            coupon.user_id == user.id
            and coupon.reward_product_id
            and coupon.is_active
            and coupon.expires_at >= datetime.utcnow()
        ):
            product = next(
                (item for item in db["products"] if item.id == coupon.reward_product_id),
                None,
            )
            if product is not None:
                active_rewards.append({
                    "code": coupon.code,
                    "product": product.to_dict(),
                    "expires_at": coupon.expires_at.isoformat(),
                })

    return jsonify({
        "points": user.points,
        "catalog": catalog,
        "active_rewards": active_rewards,
    })


@auth_bp.route("/rewards/redeem", methods=["POST"])
def redeem_reward():
    """Exchange loyalty points for a one-time voucher for one menu item."""
    user = current_user()
    if user is None:
        return jsonify({"error": "Log in to redeem rewards"}), 401

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    reward = next(
        (item for item in reward_options() if item["id"] == data.get("reward_id")),
        None,
    )
    if reward is None:
        return jsonify({"error": "Reward not found"}), 404

    product = next(
        (
            item for item in db["products"]
            if item.id == reward["product"]["id"] and item.is_available and not item.is_combo
        ),
        None,
    )
    if product is None:
        return jsonify({"error": "This reward is currently unavailable"}), 409
    points_cost = int(reward["points_cost"])
    if user.points < points_cost:
        return jsonify({"error": "You do not have enough points for this reward"}), 400

    code = f"REWARD-{secrets.token_hex(4).upper()}"
    coupon = Coupon(
        code=code,
        discount_pct=100.0,
        expires_at=datetime.utcnow() + timedelta(days=365),
        user_id=user.id,
        reward_product_id=product.id,
    )
    db["coupons"].append(coupon)
    user.points -= points_cost

    return jsonify({
        "success": True,
        "points_spent": points_cost,
        "points": user.points,
        "reward": {
            "code": coupon.code,
            "product": product.to_dict(),
            "expires_at": coupon.expires_at.isoformat(),
        },
    }), 201


@auth_bp.route("/password", methods=["PUT"])
def change_password():
    """
    Change the signed-in user's password after verifying the current one.

    Expected JSON body:
        { "current_password": "...", "new_password": "..." }

    Returns:
        200 — { "success": true }
        400 — validation error or incorrect current password
        401 — not logged in
    """
    user = current_user()
    if user is None:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict):
        return jsonify({"error": "Request body must be a JSON object"}), 400

    current_password = str(data.get("current_password", "")).strip()
    new_password = str(data.get("new_password", "")).strip()

    if not current_password or not new_password:
        return jsonify({"error": "Current and new passwords are required"}), 400
    if not check_password_hash(user.password_hash, current_password):
        return jsonify({"error": "Current password is incorrect"}), 400
    if len(new_password) < 6:
        return jsonify({"error": "New password must be at least 6 characters"}), 400
    if new_password == current_password:
        return jsonify({"error": "New password must be different from the current password"}), 400

    user.password_hash = generate_password_hash(new_password)
    return jsonify({"success": True})


@auth_bp.route("/profile", methods=["PUT"])
def update_profile():
    """
    Update the authenticated user's username.

    Expected JSON body:
        { "username": "new_username" }

    Returns:
        200 — { "success": true, "user": {...} }
        400 — validation error
        401 — not logged in
    """
    user = current_user()
    if user is None:
        return jsonify({"error": "Not logged in"}), 401

    data = request.get_json(silent=True) or {}
    new_username = str(data.get("username", "")).strip()

    if not new_username:
        return jsonify({"error": "Username cannot be empty"}), 400

    # Ensure the new username is not already taken by another account
    conflict = next(
        (u for u in db["users"] if u.username.lower() == new_username.lower() and u.id != user.id),
        None,
    )
    if conflict:
        return jsonify({"error": "That username is already taken"}), 400

    user.username = new_username
    return jsonify({"success": True, "user": user.to_dict()})
