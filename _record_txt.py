import json

d = json.load(open("C:/Users/HP/Desktop/crunchbox/_live_dump.json", encoding="utf-8"))
menu = d.get("menu", [])
lines = []
def w(s=""):
    lines.append(s)

w("LIVE MENU RECORD  (source: https://food-delievery-web-crunchbox-production.up.railway.app/api/menu)")
w("categories: " + str(len(menu)))
w("=" * 70)
for c in menu:
    w("CATEGORY: " + str(c.get("name")))
    w("  sort_order: " + str(c.get("sort_order")))
    w("  id: " + str(c.get("id")))
    w("  bestseller_id: " + str(c.get("bestseller_id")))
    w("  playlists: " + str(len(c.get("playlists", []))) + " -> " +
      "; ".join(pl.get("name", "") for pl in c.get("playlists", [])))
    prods = c.get("products", [])
    w("  product count: " + str(len(prods)))
    for i, p in enumerate(prods, 1):
        w("  PRODUCT #" + str(i))
        w("    name:            " + str(p.get("name")))
        w("    description:     " + str(p.get("description")))
        w("    price:           " + str(p.get("price")))
        w("    image_filename:  " + str(p.get("image_filename")))
        w("    image_url:       " + str(p.get("image_url")))
        w("    is_available:    " + str(p.get("is_available")))
        w("    is_bestseller:   " + str(p.get("is_bestseller")))
        w("    is_new:          " + str(p.get("is_new")))
        w("    is_reward:       " + str(p.get("is_reward")))
        w("    is_combo:        " + str(p.get("is_combo")))
        w("    combo_discount_pct: " + str(p.get("combo_discount_pct")))
        w("    reward_points:   " + str(p.get("reward_points")))
        w("    loyalty_points:  " + str(p.get("loyalty_points")))
        w("    created_at:      " + str(p.get("created_at")))
        w("    id:              " + str(p.get("id")))
    w("=" * 70)

w("")
w("LOCATIONS (" + str(len(d.get("locations", []))) + ")")
for l in d.get("locations", []):
    w("  " + str(l.get("name")) + " | branch_no " + str(l.get("branch_no")) +
      " | " + str(l.get("address")) + " | " + str(l.get("open_time")) + "-" + str(l.get("close_time")) +
      " | open_now=" + str(l.get("is_open")) + " | image=" + str(l.get("image_url")))

w("")
w("SETTINGS")
for k, v in (d.get("settings") or {}).items():
    w("  " + k + " = " + str(v))

open("C:/Users/HP/Desktop/crunchbox/_live_menu_record.txt", "w", encoding="utf-8").write("\n".join(lines))
print("written", len(lines), "lines")
print("\n".join(lines[:80]))
