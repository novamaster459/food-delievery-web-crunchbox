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

The root `requirements.txt` lets Railway detect this Python project and installs
the dependencies listed in `backend/requirements.txt`. To deploy:

1. In Railway, create a project and choose **Deploy from GitHub repo**.
2. Select `novamaster459/food-delievery-web-crunchbox`. Leave the service root
   directory set to `/`.
3. In the service's **Variables** settings, set `SECRET_KEY` to a long random
   value, `ADMIN_EMAIL` to your chosen admin email, and `ADMIN_PASSWORD` to a
   strong password. Do not rely on the public demo credentials for a deployed
   app.
4. Deploy the service, then use **Settings → Networking → Generate Domain** to
   get its public URL.

`Procfile` and `railway.json` start Gunicorn from the `backend` directory and
bind to Railway's `PORT`. The app serves its frontend and API from the same
domain, so no separate frontend service or API URL configuration is required.

The current data store and uploaded images are intentionally in memory/local
files for a simple school-project setup. They reset when the service restarts
and are not shared across multiple instances. Use a database and persistent
file/object storage before relying on this for real orders.

## Included flows

- Five seeded menu categories and products, including combo sets.
- Guest and member checkout, combo savings, and expiring coupon codes.
- Members earn 100 loyalty points per successful order; the demo member starts with 1,250 points.
- Yangon city → township → ward → street → house/room address collection.
- Admin product/category/coupon management and shop name/logo settings.
- Admin-editable storefront accent/background colors, hero copy/photo, and featured/deal card copy/photos.
- A simulated five-stage, 15-second delivery tracker.
