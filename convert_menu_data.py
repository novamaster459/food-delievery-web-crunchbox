"""
Convert all_menu_data.json (fetched from live site) to seed_snapshot.json
format used by the Flask backend, and copy images to static/uploads/.
"""
import json
import os
import shutil
from datetime import datetime, timezone, timedelta

SOURCE = r"C:\Users\HP\Desktop\crunchbox\menu item\all_menu_data.json"
IMAGES_SRC = r"C:\Users\HP\Desktop\crunchbox\menu item\images"
SEED_DEST = r"C:\Users\HP\Desktop\crunchbox\my-food-app\backend\seed_snapshot.json"
UPLOADS_DEST = r"C:\Users\HP\Desktop\crunchbox\my-food-app\frontend\static\uploads"

# Myanmar TZ for created_at fallback
MYANMAR_TZ = timezone(timedelta(hours=6, minutes=30))

def main():
    with open(SOURCE, encoding="utf-8") as f:
        data = json.load(f)

    categories = data.get("categories", [])
    locations = data.get("locations", [])
    settings = data.get("settings", {})

    menu = []
    for cat in categories:
        cat_entry = {
            "id": cat["id"],
            "name": cat["name"],
            "icon": cat.get("icon", ""),
            "sort_order": int(cat.get("sort_order", 0)),
            "bestseller_id": cat.get("bestseller_id", ""),
            "playlists": [],
            "products": [],
        }

        # Playlists
        for pl in cat.get("playlists", []):
            pl_entry = {
                "id": pl["id"],
                "name": pl["name"],
                "category_id": pl["category_id"],
                "product_ids": list(pl.get("product_ids", [])),
                "sort_order": int(pl.get("sort_order", 0)),
                "items": pl.get("items", []),
            }
            cat_entry["playlists"].append(pl_entry)

        # Products (regular grid items, not in playlists)
        for prod in cat.get("products", []):
            prod_entry = {
                "id": prod["id"],
                "category_id": prod["category_id"],
                "name": prod["name"],
                "description": prod.get("description", ""),
                "price": int(prod.get("price", 0)),
                "image_filename": prod.get("image_filename", ""),
                "image_url": prod.get("image_url", ""),
                "is_available": bool(prod.get("is_available", True)),
                "is_combo": bool(prod.get("is_combo", False)),
                "combo_discount_pct": float(prod.get("combo_discount_pct", 0.0)),
                "loyalty_points": int(prod.get("loyalty_points", 100)),
                "is_reward": bool(prod.get("is_reward", False)),
                "reward_points": int(prod.get("reward_points", 0)),
                "created_at": prod.get("created_at", datetime.now(MYANMAR_TZ).isoformat()),
            }
            cat_entry["products"].append(prod_entry)

        menu.append(cat_entry)

    snapshot = {
        "menu": menu,
        "locations": locations,
        "settings": settings,
    }

    # Write seed_snapshot.json
    with open(SEED_DEST, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2, ensure_ascii=False)
    print(f"Wrote {SEED_DEST} with {len(menu)} categories, {len(locations)} locations")

    # Copy images to uploads folder
    os.makedirs(UPLOADS_DEST, exist_ok=True)
    copied = 0
    skipped = 0
    for fname in os.listdir(IMAGES_SRC):
        src = os.path.join(IMAGES_SRC, fname)
        dst = os.path.join(UPLOADS_DEST, fname)
        if os.path.isfile(src):
            if os.path.exists(dst):
                skipped += 1
                continue
            shutil.copy2(src, dst)
            copied += 1
    print(f"Copied {copied} new images to {UPLOADS_DEST}, skipped {skipped} existing")

if __name__ == "__main__":
    main()
