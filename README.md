# CrunchBox Food Delivery

A Flask API and vanilla HTML/CSS/JavaScript storefront for a single-brand food
delivery school project. Menu prices and checkout totals are in MMK.

## Run locally

```powershell
cd backend
python -m pip install -r requirements.txt
python app.py
```

Open `http://localhost:5000`. The demo accounts are
`admin@crunchbox.com` / `admin123` and `john@example.com` / `password123`.
Change these before sharing a deployed demo with others.

## Railway deployment

Deploy the repository root. `Procfile` and `railway.json` start Gunicorn from
the `backend` directory and bind to Railway's `PORT`. Set `SECRET_KEY` to a
long random value and optionally set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in
Railway's service variables.

The current data store and uploaded images are intentionally in memory/local
files for a simple school-project setup. They reset when the service restarts
and are not shared across multiple instances. Use a database and persistent
file/object storage before relying on this for real orders.

## Included flows

- Five seeded menu categories and products, including combo sets.
- Guest and member checkout, combo savings, and expiring coupon codes.
- Yangon city → township → ward → street → house/room address collection.
- Admin product/category/coupon management and shop name/logo settings.
- Admin-editable storefront accent/background colors, hero copy/photo, and featured/deal card copy/photos.
- A simulated five-stage, 15-second delivery tracker.
