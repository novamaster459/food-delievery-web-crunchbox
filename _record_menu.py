import json, urllib.request, os

BASE = "https://food-delievery-web-crunchbox-production.up.railway.app"
out = {}

def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

try:
    menu = get("/api/menu")
    out["menu"] = menu
    print("OK menu categories:", len(menu))
except Exception as e:
    print("FAIL menu:", e)
    menu = []

try:
    out["locations"] = get("/api/locations")
    print("OK locations:", len(out["locations"]))
except Exception as e:
    print("FAIL locations:", e)

try:
    out["settings"] = get("/api/settings")
    print("OK settings")
except Exception as e:
    print("FAIL settings:", e)

open("C:/Users/HP/Desktop/crunchbox/_live_dump.json", "w", encoding="utf-8").write(
    json.dumps(out, indent=2, ensure_ascii=False)
)

print("\n===== MENU RECORD =====")
for c in menu:
    print("=== CATEGORY:", c.get("name"), "| sort_order:", c.get("sort_order"), "| icon:", c.get("icon"))
    prods = c.get("products", [])
    print("    products:", len(prods))
    for p in prods:
        print("  - NAME:", p.get("name"))
        print("    price:", p.get("price"))
        print("    desc:", p.get("description"))
        print("    image_url:", p.get("image_url"))
        print("    available:", p.get("is_available"), "| bestseller:", p.get("is_bestseller"),
              "| new:", p.get("is_new"), "| reward:", p.get("is_reward"))
        print("    combo:", p.get("is_combo"), "| combo_discount_pct:", p.get("combo_discount_pct"),
              "| reward_points:", p.get("reward_points"), "| loyalty_points:", p.get("loyalty_points"))
    print()

print("\n===== LOCATIONS =====")
for l in out.get("locations", []):
    print(l.get("name"), "| branch", l.get("branch_no"), "| addr", l.get("address"),
          "| hours", l.get("open_time"), "-", l.get("close_time"), "| open_now", l.get("is_open"),
          "| image_url", l.get("image_url"))
