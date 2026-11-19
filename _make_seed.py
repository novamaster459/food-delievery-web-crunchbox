import json

d = json.load(open("C:/Users/HP/Desktop/crunchbox/_live_dump.json", encoding="utf-8"))
menu = d.get("menu", [])
settings = d.get("settings", {})
locations = d.get("locations", [])

out = []
out.append("import json\n")
out.append("# Auto-generated from live production DB snapshot at 2026-11-19.\n")
out.append("# Replaces the old seed_data() menu/locations/settings blocks.\n")
out.append("LIVE_MENU = " + json.dumps(menu, ensure_ascii=False, indent=2) + "\n")
out.append("LIVE_LOCATIONS = " + json.dumps(locations, ensure_ascii=False, indent=2) + "\n")
out.append("LIVE_SETTINGS = " + json.dumps(settings, ensure_ascii=False, indent=2) + "\n")
open("C:/Users/HP/Desktop/crunchbox/_live_seed.py", "w", encoding="utf-8").write("".join(out))
print("seed file written:", len(menu), "categories,", len(locations), "locations, settings keys:", len(settings))