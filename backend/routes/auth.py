"""
routes/auth.py — Authentication Blueprint
==========================================
Handles user registration, login, logout, profile retrieval, and profile
updates.  All routes are mounted under the `/api/auth` prefix defined in
app.py.

The shared `db` dict is imported from app.py and mutated in place so that
changes are immediately visible across all blueprints.
"""

from flask import Blueprint, jsonify, request, session
from werkzeug.security import check_password_hash, generate_password_hash

from app import db
from models import User

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

auth_bp = Blueprint("auth", __name__)


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
