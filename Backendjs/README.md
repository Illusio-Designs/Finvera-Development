# Finvera Backend API

A **Node.js + Express + MySQL** (Sequelize) REST API that powers and manages
all content for the Finvera website: **auth/login, Projects/Work, Services,
Testimonials, Team, Blog (with SEO), Contact submissions, per‑page SEO** and
**site settings** (Google Analytics / GTM / Facebook Pixel).

## Requirements

- Node.js 18+
- A MySQL 8 database (local, or hosted e.g. PlanetScale / Railway / AWS RDS)

## Setup

```bash
cd Backendjs
cp .env.example .env          # then edit DB credentials + JWT_SECRET
# create the database once (or let a hosted provider give you one):
#   mysql -u root -p -e "CREATE DATABASE finvera CHARACTER SET utf8mb4;"
npm install
npm run dev                   # http://localhost:5000  (nodemon)
# or: npm start
```

On first boot the server:
1. connects to MySQL,
2. creates/updates tables (`DB_SYNC=true`),
3. seeds an **admin user** and sample content (the 11 real projects, services,
   testimonials, team, a blog post, SEO defaults and settings).

**Default admin** (change in `.env`): `admin@finvera.solutions` / `changeme123`.

> In production set `DB_SYNC=false` after the first run and manage schema
> changes deliberately.

## Environment (`.env`)

| Var | Purpose |
|-----|---------|
| `PORT` | API port (default 5000) |
| `CORS_ORIGIN` | Comma‑separated allowed frontend origins |
| `DB_HOST/PORT/NAME/USER/PASSWORD` | MySQL connection |
| `DB_SYNC` | `true` to auto‑sync schema on boot |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Auth token signing |
| `ADMIN_NAME/EMAIL/PASSWORD` | Seed admin account |
| `PUBLIC_URL` | Base URL used to build absolute image URLs |
| `MAX_UPLOAD_MB` | Max image upload size |

## Auth

Send `Authorization: Bearer <token>` for all write/admin endpoints.

```
POST /api/auth/login          { email, password } -> { token, user }
GET  /api/auth/me             (auth)
POST /api/auth/change-password (auth) { currentPassword, newPassword }
```

## Content endpoints

Every resource below follows the same pattern. **GET is public** (returns only
`published` items); **POST/PUT/PATCH/DELETE require auth**. Authenticated GET
also returns drafts and supports `?status=draft` and `?q=search`.

| Resource | Base path |
|----------|-----------|
| Projects / Work | `/api/projects` |
| Services | `/api/services` |
| Testimonials | `/api/testimonials` |
| Team | `/api/team` |
| Blog | `/api/blog` |

```
GET    /api/projects            list (public: published only)
GET    /api/projects/:id|:slug  one
POST   /api/projects            create (auth)
PUT    /api/projects/:id        update (auth)
DELETE /api/projects/:id        delete (auth)
```

### Contact

```
POST   /api/contact             submit (public, rate‑limited)
GET    /api/contact             list submissions (auth)
PATCH  /api/contact/:id/read    mark read/unread (auth)
DELETE /api/contact/:id         delete (auth)
```

### SEO (per page)

```
GET /api/seo                    list all page SEO (public)
GET /api/seo/:page              one page e.g. /api/seo/home
PUT /api/seo/:page              upsert (auth)
```

### Settings (analytics / pixels / brand)

```
GET /api/settings               flat { key: value } (public keys only unless auth)
GET /api/settings/all           detailed rows (auth)
PUT /api/settings               bulk upsert (auth)  body: { google_analytics_id: "G-XXXX", ... }
```

Seeded keys include: `site_name`, `site_tagline`, `contact_email`,
`contact_phone`, `social_x/linkedin/github`, `google_analytics_id`,
`google_tag_manager_id`, `facebook_pixel_id`, `google_site_verification`.

### Image uploads

```
POST /api/uploads       (auth) multipart field "file"  -> { url }
POST /api/uploads/many  (auth) multipart field "files" -> { urls: [] }
```

Uploaded files are served from `/uploads/<filename>`. Store the returned `url`
on a project's `desktopImage` / `mobileImage` / `coverImage`, a blog
`coverImage`, a team `photo`, etc. — so the site no longer depends on live
external screenshots.

## Data models

`users`, `projects`, `services`, `testimonials`, `team_members`, `blog_posts`,
`contact_submissions`, `seo_meta`, `settings`.

## Deploy

Host anywhere that runs Node + can reach MySQL (Railway, Render, a VPS, etc.):

```bash
npm install --omit=dev
NODE_ENV=production DB_SYNC=false npm start
```

Point the frontend at it via `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api`.
