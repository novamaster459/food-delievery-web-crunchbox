"""
download_images.py

Downloads any product/location images that are missing from the images/ folder.
"""

import json
import os
import urllib.request

BASE = "https://food-delievery-web-crunchbox-production.up.railway.app"
OUT_DIR = "C:/Users/HP/Desktop/crunchbox/menu item"
IMAGES_DIR = os.path.join(OUT_DIR, "images")

os.makedirs(IMAGES_DIR, exist_ok=True)

# Load the saved menu data
with open(os.path.join(OUT_DIR, "all_menu_data.json"), "r", encoding="utf-8") as f:
    data = json.load(f)

# Collect all unique image URLs
urls = set()
for cat in data["categories"]:
    for pl in cat.get("playlists", []):
        for item in pl.get("items", []):
            if item.get("image_url"):
                urls.add(item["image_url"])
    for p in cat.get("products", []):
        if p.get("image_url"):
            urls.add(p["image_url"])
for loc in data.get("locations", []):
    if loc.get("image_url"):
        urls.add(loc["image_url"])
settings = data.get("settings", {})
for k in ("hero_image_url", "featured_image_url", "deal_image_url", "logo_url"):
    u = settings.get(k)
    if u:
        urls.add(u)

print(f"Total unique image URLs: {len(urls)}")

# Check which already exist
existing = set(os.listdir(IMAGES_DIR))
missing = []
for u in sorted(urls):
    fname = u.rsplit("/", 1)[-1]
    if fname not in existing:
        missing.append(u)

print(f"Already downloaded: {len(urls) - len(missing)}")
print(f"Missing: {len(missing)}")

n = 0
for u in missing:
    fname = u.rsplit("/", 1)[-1]
    local_path = os.path.join(IMAGES_DIR, fname)
    try:
        req = urllib.request.Request(BASE + u, headers={"User-Agent": "Mozilla/5.0"})
        data_img = urllib.request.urlopen(req, timeout=40).read()
        with open(local_path, "wb") as f:
            f.write(data_img)
        n += 1
        print(f"  [OK] {fname} ({len(data_img)} bytes)")
    except Exception as e:
        print(f"  [FAIL] {u}: {e}")

print(f"\nDownloaded {n} of {len(missing)} missing images")
print("Done!")
