import json, urllib.request, os

d = json.load(open("C:/Users/HP/Desktop/crunchbox/_live_dump.json", encoding="utf-8"))
urls = set()
menu = d.get("menu", [])
for c in menu:
    for p in c.get("products", []):
        u = p.get("image_url")
        if u: urls.add(u)
for l in d.get("locations", []):
    u = l.get("image_url")
    if u: urls.add(u)
settings = d.get("settings") or {}
for k in ("hero_image_url", "featured_image_url", "deal_image_url", "logo_url"):
    u = settings.get(k)
    if u: urls.add(u)

os.makedirs("C:/Users/HP/Desktop/crunchbox/my-food-app/frontend/static/uploads", exist_ok=True)
base = "https://food-delievery-web-crunchbox-production.up.railway.app"
n = 0
for u in sorted(urls):
    fname = u.rsplit("/", 1)[-1]
    path = os.path.join("C:/Users/HP/Desktop/crunchbox/my-food-app/frontend/static/uploads", fname)
    try:
        req = urllib.request.Request(base + u, headers={"User-Agent": "Mozilla/5.0"})
        data = urllib.request.urlopen(req, timeout=40).read()
        open(path, "wb").write(data)
        n += 1
        print("OK", fname, len(data))
    except Exception as e:
        print("FAIL", u, e)
print("downloaded", n, "of", len(urls))
