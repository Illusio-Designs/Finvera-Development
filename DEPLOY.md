# Deployment & required secrets

- **Frontend** → **Vercel** (SSR). Deploys automatically when `main` updates.
- **Backend (`Backendjs/`)** → **GitHub Actions → FTP** (cPanel / Phusion Passenger).
  Deploys on push to the **`backend`** branch (create it from `main` once).

All values below are **DUMMY examples** — replace with your real values.

---

## 1) Frontend — Vercel Environment Variables

Vercel → your project → **Settings → Environment Variables** (Production).
Also set **Settings → Build & Deployment → Root Directory = `frontend`**.

| Name                   | Example (dummy) value                     | Notes |
|------------------------|-------------------------------------------|-------|
| `API_URL`              | `https://api.finvera.solutions`           | Backend base URL used for SSR/build fetches. **No** trailing `/api`. |
| `NEXT_PUBLIC_API_URL`  | `https://api.finvera.solutions`           | Same URL, used by the browser (contact form + admin login). |
| `NEXT_PUBLIC_SITE_URL` | `https://www.finvera.solutions`           | Public site URL for `sitemap.xml` / `robots.txt`. |
| `API_REVALIDATE`       | `60`                                      | Optional. Seconds of ISR cache for API data (default 60). |

> If you leave `API_URL` / `NEXT_PUBLIC_API_URL` unset, the site runs on built-in
> mock data and the admin runs in demo mode.

---

## 2) Backend — GitHub Actions Secrets

Repo → **Settings → Secrets and variables → Actions → Secrets** (New repository secret).
The workflow uses a `production` environment — add them there, or as repo secrets.

The FTP host / user / remote-dir are **already baked into the workflow** (values below),
so you only strictly need to add **`FTP_PASS`** and **`BACKEND_ENV`**.

| Secret           | Required? | Value                            | Notes |
|------------------|-----------|----------------------------------|-------|
| `FTP_PASS`       | **Yes**   | *your FTP password*              | Password for user `informative`. |
| `BACKEND_ENV`    | Recommended | *(the multi-line block below)* | Full backend `.env`; uploaded to the app dir on every deploy. |
| `FTP_SERVER`     | No (default) | `ftp.illusiodesigns.agency`   | Override only if the host changes. |
| `FTP_USER`       | No (default) | `informative`                 | Override only if the user changes. |
| `FTP_REMOTE_DIR` | No (default) | `api.finvera.solutions/`      | Override only if the app folder changes. |

Baked-in FTP settings: **host** `ftp.illusiodesigns.agency`, **user** `informative`,
**protocol** `ftps` (explicit TLS), **port** `21`, **dir** `api.finvera.solutions/`.

### `BACKEND_ENV` secret contents (dummy)

Paste this whole block as the value of the `BACKEND_ENV` secret:

```env
PORT=5000
NODE_ENV=production
CORS_ORIGIN=https://www.finvera.solutions,https://finvera.solutions

DB_HOST=localhost
DB_PORT=3306
DB_NAME=finvera_db
DB_USER=finvera_user
DB_PASSWORD=change-me-db-password
# Set true ONLY for the first deploy (creates tables + seeds), then set false.
DB_SYNC=false

JWT_SECRET=replace-with-a-64-char-random-string
JWT_EXPIRES_IN=7d

ADMIN_NAME=Admin
ADMIN_EMAIL=finvetasolutionsllp@gmail.com
ADMIN_PASSWORD=change-me-strong-admin-password

PUBLIC_URL=https://api.finvera.solutions
MAX_UPLOAD_MB=8
```

> (Optional) Repository **Variables** — none required for the backend workflow;
> protocol is fixed to `ftps` / port `21` in the YAML (change there if your host
> is plain `ftp`).

---

## 3) First-time backend setup on cPanel

1. In cPanel → **Setup Node.js App**: create an app, **Application root = `api.finvera.solutions`**
   (same folder the workflow uploads to), **Application startup file = `server.js`**, Node 18+.
2. Add the `FTP_PASS` (+ `BACKEND_ENV`) GitHub secrets.
3. Create the `backend` branch from `main` and push (or run the workflow manually
   via **Actions → Backend CI/CD → Run workflow**). It uploads the code + `.env`.
4. In the cPanel Node app, click **Run NPM Install** (node_modules are not uploaded),
   then **Restart**. For the very first run set `DB_SYNC=true` in `BACKEND_ENV` so
   tables are created and seeded, then switch it back to `false`.
5. Point the frontend at the backend URL (Vercel env `API_URL` / `NEXT_PUBLIC_API_URL`)
   and add that domain to `CORS_ORIGIN`.

Subsequent pushes to `backend` (touching `Backendjs/**`) auto-deploy: incremental
FTP sync → `.env` upload → Passenger restart (`tmp/restart.txt`).
```
