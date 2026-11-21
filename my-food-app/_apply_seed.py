import re

p = "backend/app.py"
s = open(p, encoding="utf-8").read()

# 1) Replace the Categories .. Playlists demo section inside seed_data()
start_marker = "    # ------------------------------------------------------------------\n    # Categories\n"
end_marker = "    # Mark the built-in reward items so members can redeem them with points.\n"
i = s.index(start_marker)
j = s.index(end_marker)

new_block = '''    # ------------------------------------------------------------------
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

'''
s = s[:i] + new_block + s[j:]

# 2) Make sure json + BranchLocation + Playlist are imported
if "import json" not in s.split("def seed_data")[0]:
    s = s.replace("import os\n", "import os\nimport json\n", 1)
if "BranchLocation" not in s.split("def seed_data")[0]:
    s = s.replace("from models import Category, Coupon, Order, Product, User, Playlist",
                  "from models import BranchLocation, Category, Coupon, Order, Product, User, Playlist")
if "Playlist" not in s.split("def seed_data")[0]:
    s = s.replace("from models import BranchLocation, Category, Coupon, Order, Product, User",
                  "from models import BranchLocation, Category, Coupon, Order, Product, User, Playlist")

open(p, "w", encoding="utf-8", newline="").write(s)
print("seed_data replaced ok")
