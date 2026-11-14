"""
routes/games.py — Games Blueprint
=================================
Handles the Lucky Spin game. The server draws the winning segment so the
prize cannot be manipulated from the browser.

Mounted at `/api/games` in app.py.
"""

import random

from flask import Blueprint, jsonify, session

from app import db

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------

games_bp = Blueprint("games", __name__)


# ---------------------------------------------------------------------------
# Lucky Spin
# ---------------------------------------------------------------------------

LUCKY_SPIN_COST = 100

# Weights are percentages: 25 pt appears twice (10% each) for 20% combined.
LUCKY_SPIN_SEGMENTS = [
    {"points": 25, "weight": 10},
    {"points": 50, "weight": 20},
    {"points": 25, "weight": 10},
    {"points": 75, "weight": 20},
    {"points": 100, "weight": 20},
    {"points": 250, "weight": 10},
    {"points": 500, "weight": 5},
    {"points": 1000, "weight": 3},
    {"points": 1250, "weight": 2},
]


def _current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    return next((user for user in db["users"] if user.id == user_id), None)


@games_bp.route("/lucky-spin", methods=["GET"])
def lucky_spin_info():
    """Return the spin cost, prize table, and the player's point balance."""
    user = _current_user()
    return jsonify({
        "cost": LUCKY_SPIN_COST,
        "segments": LUCKY_SPIN_SEGMENTS,
        "logged_in": user is not None,
        "points": user.points if user is not None else 0,
    })


@games_bp.route("/lucky-spin", methods=["POST"])
def lucky_spin():
    """Charge the spin cost, draw a segment, and credit the prize points."""
    user = _current_user()
    if user is None:
        return jsonify({"error": "Sign in to play Lucky Spin."}), 401
    if user.points < LUCKY_SPIN_COST:
        return jsonify({
            "error": f"You need {LUCKY_SPIN_COST} points to spin. You have {user.points}.",
        }), 400

    index = random.choices(
        range(len(LUCKY_SPIN_SEGMENTS)),
        weights=[segment["weight"] for segment in LUCKY_SPIN_SEGMENTS],
        k=1,
    )[0]
    prize_points = LUCKY_SPIN_SEGMENTS[index]["points"]

    user.points = user.points - LUCKY_SPIN_COST + prize_points
    return jsonify({
        "success": True,
        "segment": index,
        "prize_points": prize_points,
        "cost": LUCKY_SPIN_COST,
        "points": user.points,
    })
