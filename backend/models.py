"""
models.py — CrunchBox In-Memory Data Models
============================================
Defines plain Python dataclasses used as the in-memory data layer for the
CrunchBox food delivery application. No ORM or database is required; all
data lives in a module-level dict in app.py.

Each dataclass exposes a `to_dict()` method that returns a fully
JSON-serialisable dictionary suitable for use in Flask `jsonify()` calls.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional
import uuid


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _new_id() -> str:
    """Generate a compact, unique string ID."""
    return str(uuid.uuid4())


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------

@dataclass
class User:
    """Represents a registered customer or administrator account."""

    id: str = field(default_factory=_new_id)
    username: str = ""
    email: str = ""
    password_hash: str = ""          # Werkzeug-hashed; never exposed to client
    is_admin: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    points: int = 0                  # Loyalty points earned on each order

    def to_dict(self) -> dict:
        """Return a JSON-serialisable dict (password_hash excluded)."""
        return {
            "id": self.id,
            "username": self.username,
            "email": self.email,
            "is_admin": self.is_admin,
            "created_at": self.created_at.isoformat(),
            "points": self.points,
        }


# ---------------------------------------------------------------------------
# Category
# ---------------------------------------------------------------------------

@dataclass
class Category:
    """A top-level menu category (e.g. Mains, Drinks, Desserts)."""

    id: str = field(default_factory=_new_id)
    name: str = ""
    icon: str = ""          # Emoji string displayed in the UI
    sort_order: int = 0     # Ascending order for display

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "sort_order": self.sort_order,
        }


# ---------------------------------------------------------------------------
# Product
# ---------------------------------------------------------------------------

@dataclass
class Product:
    """
    A menu item belonging to a single category.

    Prices are stored in Myanmar Kyat (MMK) as integers to avoid
    floating-point rounding issues during arithmetic.
    """

    id: str = field(default_factory=_new_id)
    category_id: str = ""
    name: str = ""
    description: str = ""
    price: int = 0                      # Price in MMK (integer)
    image_filename: str = ""            # Filename inside /static/uploads/
    is_available: bool = True
    is_combo: bool = False              # True for bundled combo products
    combo_discount_pct: float = 0.0    # Extra % off applied to combo items

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "category_id": self.category_id,
            "name": self.name,
            "description": self.description,
            "price": self.price,
            "image_filename": self.image_filename,
            "image_url": f"/static/uploads/{self.image_filename}" if self.image_filename else "",
            "is_available": self.is_available,
            "is_combo": self.is_combo,
            "combo_discount_pct": self.combo_discount_pct,
        }


# ---------------------------------------------------------------------------
# Coupon
# ---------------------------------------------------------------------------

@dataclass
class Coupon:
    """A promotional coupon code redeemable at checkout."""

    id: str = field(default_factory=_new_id)
    code: str = ""                      # Uppercase alphanumeric code
    discount_pct: float = 0.0          # Percentage discount (0–100)
    expires_at: datetime = field(default_factory=datetime.utcnow)
    is_active: bool = True
    user_id: str = ""                  # Set for single-use, member-only reward coupons
    reward_product_id: str = ""        # Restricts a reward coupon to one product unit

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "code": self.code,
            "discount_pct": self.discount_pct,
            "expires_at": self.expires_at.isoformat(),
            "is_active": self.is_active,
        }


# ---------------------------------------------------------------------------
# Order
# ---------------------------------------------------------------------------

@dataclass
class Order:
    """
    A placed customer order.

    `items` is a list of dicts, each containing:
        product_id, name, unit_price, quantity, subtotal,
        is_combo, combo_discount_pct, combo_savings
    `address` is a dict with keys: city, township, ward, street, house.
    `status` cycles through: 'pending' → 'confirmed' → 'preparing'
        → 'out_for_delivery' → 'delivered' | 'cancelled'
    """

    id: str = field(default_factory=_new_id)
    user_id: Optional[str] = None       # None for guest orders
    items: List[dict] = field(default_factory=list)
    subtotal: int = 0                   # Raw sum before discounts (MMK)
    discount_amount: int = 0            # Total savings applied (MMK)
    total: int = 0                      # Amount customer pays (MMK)
    address: dict = field(default_factory=dict)
    coupon_code: str = ""
    status: str = "pending"
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "items": self.items,
            "subtotal": self.subtotal,
            "discount_amount": self.discount_amount,
            "total": self.total,
            "address": self.address,
            "coupon_code": self.coupon_code,
            "status": self.status,
            "created_at": self.created_at.isoformat(),
        }


# ---------------------------------------------------------------------------
# CartItem  (transient — used for validation/serialisation, not stored)
# ---------------------------------------------------------------------------

@dataclass
class CartItem:
    """
    A single line item held in a shopping cart.

    CartItems are ephemeral: they are constructed during checkout processing
    and are never persisted directly — their data is embedded inside an Order.
    """

    product_id: str = ""
    quantity: int = 1
    unit_price: int = 0     # Snapshot of product price at time of cart add
    name: str = ""          # Snapshot of product name

    def to_dict(self) -> dict:
        return {
            "product_id": self.product_id,
            "quantity": self.quantity,
            "unit_price": self.unit_price,
            "name": self.name,
            "subtotal": self.unit_price * self.quantity,
        }
