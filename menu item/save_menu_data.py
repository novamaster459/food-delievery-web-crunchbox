"""
save_menu_data.py

Fetches all menu data from the live CrunchBox production site and saves it
locally under C:/Users/HP/Desktop/crunchbox/menu item/

Saves:
  - all_menu_data.json : Complete structured data (categories, products,
                         playlists, locations, settings)
  - menu_summary.txt   : Human-readable summary of every item
  - images/            : Downloaded product photos
"""

import json
import os
import urllib.request
from datetime import datetime

BASE = "https://food-delievery-web-crunchbox-production.up.railway.app"
OUT_DIR = "C:/Users/HP/Desktop/crunchbox/menu item"
IMAGES_DIR = os.path.join(OUT_DIR, "images")

os.makedirs(IMAGES_DIR, exist_ok=True)


def get(path):
    """Fetch JSON from the live API."""
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))


def download_image(url):
    """Download an image from the live site and return the local filename."""
    if not url:
        return ""
    fname = url.rsplit("/", 1)[-1]
    local_path = os.path.join(IMAGES_DIR, fname)
    if os.path.exists(local_path):
        return fname  # already downloaded
    try:
        req = urllib.request.Request(BASE + url, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=40).read()
        with open(local_path, "wb") as f:
            f.write(data)
        print(f"  [IMG] {fname} ({len(data)} bytes)")
        return fname
    except Exception as e:
        print(f"  [IMG FAIL] {url}: {e}")
        return ""


def main():
    print("Fetching data from live site...")
    menu = get("/api/menu")
    locations = get("/api/locations")
    settings = get("/api/settings")

    print(f"  Categories: {len(menu)}")
    print(f"  Locations: {len(locations)}")

    output = {
        "saved_at": datetime.utcnow().isoformat() + "Z",
        "source": BASE,
        "categories": [],
        "locations": locations,
        "settings": settings,
    }

    total_products = 0
    total_playlists = 0

    for cat in menu:
        cat_out = {
            "id": cat.get("id"),
            "name": cat.get("name"),
            "icon": cat.get("icon", ""),
            "sort_order": cat.get("sort_order", 0),
            "bestseller_id": cat.get("bestseller_id"),
            "playlists": [],
            "products": [],
        }

        # Playlists
        for pl in cat.get("playlists", []):
            pl_out = {
                "id": pl.get("id"),
                "name": pl.get("name"),
                "category_id": pl.get("category_id"),
                "product_ids": pl.get("product_ids", []),
                "sort_order": pl.get("sort_order", 0),
                "items": [],
            }
            for item in pl.get("items", []):
                pl_out["items"].append({
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "description": item.get("description", ""),
                    "price": item.get("price", 0),
                    "image_filename": item.get("image_filename", ""),
                    "image_url": item.get("image_url", ""),
                    "is_available": item.get("is_available", True),
                    "is_combo": item.get("is_combo", False),
                    "combo_discount_pct": item.get("combo_discount_pct", 0.0),
                    "loyalty_points": item.get("loyalty_points", 0),
                    "is_reward": item.get("is_reward", False),
                    "reward_points": item.get("reward_points", 0),
                    "is_new": item.get("is_new", False),
                    "is_bestseller": item.get("is_bestseller", False),
                    "created_at": item.get("created_at", ""),
                })
                if item.get("image_url"):
                    download_image(item["image_url"])
            cat_out["playlists"].append(pl_out)
            total_playlists += 1

        # Products
        for p in cat.get("products", []):
            prod_out = {
                "id": p.get("id"),
                "category_id": p.get("category_id"),
                "name": p.get("name"),
                "description": p.get("description", ""),
                "price": p.get("price", 0),
                "image_filename": p.get("image_filename", ""),
                "image_url": p.get("image_url", ""),
                "is_available": p.get("is_available", True),
                "is_combo": p.get("is_combo", False),
                "combo_discount_pct": p.get("combo_discount_pct", 0.0),
                "loyalty_points": p.get("loyalty_points", 0),
                "is_reward": p.get("is_reward", False),
                "reward_points": p.get("reward_points", 0),
                "is_new": p.get("is_new", False),
                "is_bestseller": p.get("is_bestseller", False),
                "created_at": p.get("created_at", ""),
            }
            cat_out["products"].append(prod_out)
            total_products += 1
            if p.get("image_url"):
                download_image(p["image_url"])

        output["categories"].append(cat_out)

    print(f"\nTotal products: {total_products}")
    print(f"Total playlists: {total_playlists}")

    json_path = os.path.join(OUT_DIR, "all_menu_data.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\nSaved: {json_path}")

    txt_path = os.path.join(OUT_DIR, "menu_summary.txt")
    with open(txt_path, "w", encoding="utf-8") as f:
        f.write("=" * 70 + "\n")
        f.write("CRUNCHBOX MENU ITEM DETAILS\n")
        f.write(f"Source: {BASE}\n")
        f.write(f"Saved at: {output['saved_at']}\n")
        f.write("=" * 70 + "\n\n")

        for cat in output["categories"]:
            f.write("-" * 70 + "\n")
            f.write(f"CATEGORY: {cat['name']}\n")
            f.write(f"  ID: {cat['id']}\n")
            f.write(f"  Sort order: {cat['sort_order']}\n")
            f.write(f"  Bestseller ID: {cat['bestseller_id']}\n")
            f.write(f"  Icon: {cat['icon']}\n")
            f.write(f"  Products: {len(cat['products'])}\n")
            f.write(f"  Playlists: {len(cat['playlists'])}\n")
            f.write("-" * 70 + "\n\n")

            for pl in cat["playlists"]:
                f.write(f"  PLAYLIST: {pl['name']}\n")
                f.write(f"    ID: {pl['id']}\n")
                f.write(f"    Product IDs: {', '.join(pl['product_ids'])}\n")
                f.write(f"    Items in playlist: {len(pl['items'])}\n")
                for item in pl["items"]:
                    f.write(f"      - {item['name']}\n")
                    f.write(f"        ID: {item['id']}\n")
                    f.write(f"        Price: {item['price']} MMK\n")
                    f.write(f"        Description: {item['description']}\n")
                    f.write(f"        Image: {item['image_filename']}\n")
                    f.write(f"        Available: {item['is_available']}\n")
                    f.write(f"        Combo: {item['is_combo']} (discount {item['combo_discount_pct']}%)\n")
                    f.write(f"        Reward (redeemable): {item['is_reward']}\n")
                    if item["is_reward"]:
                        f.write(f"        Reward points cost: {item['reward_points']}\n")
                    f.write(f"        Loyalty points earned: {item['loyalty_points']}\n")
                    f.write(f"        New: {item['is_new']} | Bestseller: {item['is_bestseller']}\n")
                    f.write(f"        Created: {item['created_at']}\n")
                    f.write("\n")
                f.write("\n")

            for p in cat["products"]:
                f.write(f"  PRODUCT: {p['name']}\n")
                f.write(f"    ID: {p['id']}\n")
                f.write(f"    Category ID: {p['category_id']}\n")
                f.write(f"    Price: {p['price']} MMK\n")
                f.write(f"    Description: {p['description']}\n")
                f.write(f"    Image: {p['image_filename']}\n")
                f.write(f"    Image URL: {p['image_url']}\n")
                f.write(f"    Available: {p['is_available']}\n")
                f.write(f"    Combo: {p['is_combo']} (discount {p['combo_discount_pct']}%)\n")
                f.write(f"    Reward (redeemable): {p['is_reward']}\n")
                if p["is_reward"]:
                    f.write(f"    Reward points cost: {p['reward_points']}\n")
                f.write(f"    Loyalty points earned: {p['loyalty_points']}\n")
                f.write(f"    New: {p['is_new']} | Bestseller: {p['is_bestseller']}\n")
                f.write(f"    Created: {p['created_at']}\n")
                f.write("-" * 50 + "\n\n")

        f.write("=" * 70 + "\n")
        f.write("LOCATIONS\n")
        f.write("=" * 70 + "\n\n")
        for loc in output["locations"]:
            f.write(f"  {loc['name']} | Branch #{loc['branch_no']}\n")
            f.write(f"    Address: {loc['address']}\n")
            f.write(f"    Hours: {loc['open_time']} - {loc['close_time']}\n")
            f.write(f"    Open now: {loc.get('is_open', 'N/A')}\n")
            f.write(f"    Image: {loc.get('image_filename', '')}\n")
            f.write(f"    Image URL: {loc.get('image_url', '')}\n")
            f.write("\n")

        f.write("=" * 70 + "\n")
        f.write("SETTINGS\n")
        f.write("=" * 70 + "\n\n")
        for k, v in output["settings"].items():
            f.write(f"  {k}: {v}\n")

    print(f"Saved: {txt_path}")
    print(f"Images saved to: {IMAGES_DIR}")
    print("\nDone!")


if __name__ == "__main__":
    main()
