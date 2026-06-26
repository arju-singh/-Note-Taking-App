# 🦚 Peacock — Secure Expiring Note Sharing

A small note-sharing app with secure, expiring share links. Create a note, get a
share link, and control exactly how it can be opened: **one-time** or
**time-based**, **public** or **password-protected** — with accurate, race-safe
view counting and force-revoke.

---

## Tech stack

| Layer       | Choice                                                        |
| ----------- | ------------------------------------------------------------ |
| Framework   | **Next.js 16** (App Router) + **TypeScript**                  |
| Styling     | **Tailwind CSS v4**, shadcn/ui-style components (hand-built)  |
| API         | **Next.js Route Handlers** (`app/api/**`)                     |
| Database    | **PostgreSQL**                                                |
| DB access   | **node-postgres (`pg`)** with hand-written SQL + transactions |
| Auth        | Email/password, **bcrypt** hashing, **JWT** in an httpOnly cookie (`jose`) |
| IDs/tokens  | `nanoid` (URL-safe tokens + human-friendly access keys)       |
| Validation  | `zod`                                                         |

> **Why raw SQL instead of an ORM?** Prisma was the original choice, but the
> Prisma CLI (`prisma generate` / `migrate`) hangs at startup in this particular
> sandbox environment, so the client could never be generated here. To ship a
> working app I switched to `node-postgres` with explicit SQL. This turned out to
> be a feature for this task: the race-condition handling is expressed directly
> as `SELECT … FOR UPDATE` + atomic `UPDATE`, which is easy to read and audit. The
> equivalent Prisma schema is documented below.

---

## Setup instructions

### Prerequisites

- Node.js 20+ (developed on Node 24)
- PostgreSQL 14+ running locally (or any Postgres connection string)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```ini
# Local Postgres via unix socket (macOS Homebrew default):
DATABASE_URL="postgresql://<user>@localhost/peacock?host=/tmp"
# …or standard TCP:
# DATABASE_URL="postgresql://user:password@localhost:5432/peacock"

AUTH_SECRET="a-long-random-secret-at-least-16-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### 3. Create the database & schema

```bash
createdb peacock                 # if it doesn't exist
npm run db:setup                 # applies sql/001_init.sql
npm run db:seed                  # creates demo users (see Test credentials)
```

`db:setup` runs `psql "$DATABASE_URL" -f sql/001_init.sql`. (`psql` must be on
your PATH.) To wipe and recreate: `npm run db:reset`.

### 4. Run

```bash
npm run dev
# open http://localhost:3000
```

### Test credentials

| Email               | Password      |
| ------------------- | ------------- |
| `demo@peacock.app`  | `password123` |
| `alice@peacock.app` | `password123` |

---

## Pages

| Route            | Purpose                                                      |
| ---------------- | ----------------------------------------------------------- |
| `/login`         | Log in                                                       |
| `/register`      | Create an account                                            |
| `/`              | Your notes (dashboard)                                       |
| `/notes/new`     | Create a note + generate its first share link               |
| `/notes/[id]`    | Manage a note: see links, statuses, view counts, revoke, add links |
| `/share/[token]` | Recipient view: public open / password unlock               |

## API

| Method + path                        | Description                                  |
| ------------------------------------ | -------------------------------------------- |
| `POST /api/auth/register`            | Create account, set session cookie           |
| `POST /api/auth/login`               | Log in                                        |
| `POST /api/auth/logout`              | Clear session                                 |
| `POST /api/notes`                    | Create note + first share link (atomic)       |
| `GET  /api/notes`                    | List your notes                               |
| `GET  /api/notes/[id]`               | Note + its links (owner only)                 |
| `POST /api/notes/[id]/shares`        | Add another share link to a note              |
| `POST /api/shares/[id]/revoke`       | Force-invalidate a link (owner only)          |
| `GET  /api/share/[token]/meta`       | Link status/type — **does not** count a view  |
| `POST /api/share/[token]/access`     | Open the note — **the only** endpoint that counts views / consumes one-time links |

---

## Database schema

```
users
  id            text  PK
  email         text  UNIQUE
  password_hash text        -- bcrypt
  created_at    timestamptz

notes
  id         text PK
  title      text
  content    text
  author_id  text -> users.id  (cascade)
  created_at, updated_at timestamptz

share_links
  id              text PK
  token           text UNIQUE          -- public token in /share/[token]
  note_id         text -> notes.id     (cascade)
  creator_id      text -> users.id     (cascade)
  share_type      enum('ONE_TIME','TIME_BASED')
  access_type     enum('PUBLIC','PASSWORD_PROTECTED')
  password_hash   text   NULL          -- bcrypt of access key (NULL for PUBLIC)
  expires_at      timestamptz NULL     -- for TIME_BASED
  revoked         boolean DEFAULT false -- force-revoke flag
  used_at         timestamptz NULL     -- set when a ONE_TIME link is consumed
  view_count      integer DEFAULT 0    -- only successful views
  failed_attempts integer DEFAULT 0    -- brute-force throttle
  locked_until    timestamptz NULL     -- brute-force lockout
  created_at      timestamptz

view_logs                              -- one row per counted view (audit)
  id            text PK
  share_link_id text -> share_links.id (cascade)
  viewed_at     timestamptz
  ip_hash       text NULL              -- hashed IP, optional
```

<details>
<summary>Equivalent Prisma schema (the original intent)</summary>

```prisma
model User { id String @id @default(cuid()) email String @unique passwordHash String createdAt DateTime @default(now()) notes Note[] shareLinks ShareLink[] }
model Note { id String @id @default(cuid()) title String content String createdAt DateTime @default(now()) updatedAt DateTime @updatedAt authorId String author User @relation(fields:[authorId], references:[id], onDelete:Cascade) shareLinks ShareLink[] }
enum ShareType { ONE_TIME TIME_BASED }
enum AccessType { PUBLIC PASSWORD_PROTECTED }
model ShareLink { id String @id @default(cuid()) token String @unique shareType ShareType accessType AccessType passwordHash String? expiresAt DateTime? revoked Boolean @default(false) usedAt DateTime? viewCount Int @default(0) failedAttempts Int @default(0) lockedUntil DateTime? createdAt DateTime @default(now()) noteId String creatorId String views ViewLog[] }
model ViewLog { id String @id @default(cuid()) shareLinkId String viewedAt DateTime @default(now()) ipHash String? }
```
</details>

---

## How it works

### Share link flow

1. User creates a note and picks **share type** + **access type** (`/notes/new`).
2. The server (`POST /api/notes`) inserts the note **and** its first share link in
   **one transaction**.
3. A random URL-safe `token` is generated for the public URL
   `/share/<token>`.
4. For **password-protected** links, a random **access key** is generated, its
   bcrypt hash is stored, and the **plaintext key is returned exactly once** to the
   creator (never stored in plaintext, never shown again).
5. The recipient opens `/share/<token>`. The page calls `…/meta` to decide what to
   render (public "View note" button vs. key prompt vs. "unavailable"). Opening the
   note calls `POST …/access`, which is the single source of truth for validity,
   counting, and one-time consumption.

### Password / key generation logic

- **Token** (`lib/share.ts`): 24 chars from a 64-symbol URL-safe alphabet
  (`nanoid`) ≈ **144 bits** of entropy — unguessable.
- **Access key**: 16 chars from a 32-symbol alphabet that excludes ambiguous
  characters (`0/O`, `1/I/l`), formatted as `XXXX-XXXX-XXXX-XXXX` ≈ **80 bits** of
  entropy. Stored only as a **bcrypt hash**; compared with `bcrypt.compare`.

### Expiry logic

- **TIME_BASED**: link carries an absolute `expires_at`. On every open, if
  `expires_at <= now()` the request is rejected with `EXPIRED` (HTTP 410) and the
  view is **not** counted. (Validated as a future timestamp at creation.)
- **ONE_TIME**: no clock; the link is "consumed" on the first successful open by
  stamping `used_at`. Any later open returns `USED` (HTTP 410).

### Invalidate / revoke logic

- `POST /api/shares/[id]/revoke` sets `revoked = true` using
  `UPDATE … WHERE id = $1 AND creator_id = $2 RETURNING …` — the `WHERE` enforces
  ownership and the `RETURNING` distinguishes "revoked" from "not yours / not
  found". Revocation is checked first on every access, so a revoked link is dead
  immediately. Idempotent.

### View count logic

A view is counted **only on a successful open**:

| Event                          | Counted? |
| ------------------------------ | -------- |
| Public open                    | ✅ yes    |
| Correct password unlock        | ✅ yes    |
| Wrong password                 | ❌ no (increments `failed_attempts` instead) |
| Expired / revoked / used link  | ❌ no    |
| Invalid token                  | ❌ no    |

The increment happens **inside the same locked transaction** as the validity
check and one-time consumption (see below), so the counter can never be
double-incremented or incremented for a rejected open.

### Race-condition handling

All of validity-check → one-time-consume → count → audit happens in **one
transaction** that first takes a **row lock**:

```sql
BEGIN;
SELECT * FROM share_links WHERE token = $1 FOR UPDATE;   -- row lock
-- check revoked / used_at / expires_at / password
UPDATE share_links
   SET view_count = view_count + 1,
       used_at = CASE WHEN share_type='ONE_TIME' AND used_at IS NULL
                      THEN now() ELSE used_at END
 WHERE id = $1;
INSERT INTO view_logs (...);
COMMIT;
```

`SELECT … FOR UPDATE` serializes concurrent requests for the **same** link. See
`lib/access.ts`.

---

## Brief answers

**How do you prevent two users from using a one-time link at the same time?**
The whole access decision runs in a transaction that starts with
`SELECT … FOR UPDATE` on the link row. Two concurrent requests are serialized by
that row lock: the first transaction checks `used_at IS NULL`, stamps `used_at`,
and commits; the second only acquires the lock *after* the first commits, sees
`used_at` set, and is rejected with `USED`. So exactly one of N simultaneous
opens wins. (Verified by a test that fires 10 concurrent opens — 1 succeeds, 9
get `USED`, final `view_count = 1`.)

**How do you update view count safely?**
The increment is part of the same locked transaction as the success decision, so
it's atomic and only runs on a genuine successful view. There's no read-modify-
write race because the row is locked, and failed/expired/revoked opens never
reach the increment. `view_logs` also gives an independent audit trail
(`COUNT(*) == view_count`).

**How would this work if 1 million people opened the link?**
- The hot path is a single indexed row (`token` is unique-indexed) plus a short
  locked transaction — Postgres handles this well.
- For a **one-time** link, the row lock means opens are serialized, but each is
  sub-millisecond; only the first succeeds anyway, so contention is irrelevant.
- For a **public/time-based** link under massive concurrent load, the row lock on
  a single counter becomes the bottleneck (lock contention on one row). Scale it
  by **not** locking per view: append to `view_logs` (or a queue/Redis `INCR`)
  and aggregate the count asynchronously, or shard the counter into N rows and
  sum them. Add a CDN/read cache for the note content and connection pooling
  (e.g. PgBouncer). The correctness model (atomic check+consume) stays the same;
  only the counter strategy changes for scale.

**How would you prevent brute-force attempts on password-protected links?**
Two layers: (1) per-link throttling in the DB — `failed_attempts` increments on
each wrong key; after 5 failures the link is locked via `locked_until` for 15
minutes (HTTP 429), and a correct key clears the counter; (2) the access keys
have ~80 bits of entropy and are bcrypt-hashed, so offline/online guessing is
infeasible. In production I'd add per-IP rate limiting (Redis) and optionally a
CAPTCHA after repeated failures. (Per-IP throttling already protects the
login/register endpoints — see `lib/ratelimit.ts`.)

---

## Deployment (Vercel + Neon)

The app is zero-config on Vercel. Postgres is hosted on [Neon](https://neon.tech)
(free tier). TLS is enabled automatically for remote databases (see `lib/db.ts`).

### 1. Create the database (Neon)

1. Create a Neon project → copy the **pooled** connection string (host contains
   `-pooler`), which looks like:
   `postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/peacock?sslmode=require`
2. Load the schema. Either paste `sql/001_init.sql` into Neon's **SQL Editor**, or
   run it locally against Neon:
   ```bash
   DATABASE_URL="<neon-pooled-url>" npm run db:setup
   DATABASE_URL="<neon-pooled-url>" npm run db:seed   # optional demo users
   ```

### 2. Deploy (Vercel)

```bash
npm i -g vercel        # or use the dashboard: New Project → import the GitHub repo
vercel                 # link/create the project
```

Set these **Environment Variables** in the Vercel project (Production + Preview):

| Variable              | Value                                                        |
| --------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`        | Neon **pooled** connection string (with `?sslmode=require`)  |
| `AUTH_SECRET`         | output of `openssl rand -base64 32`                          |
| `NEXT_PUBLIC_APP_URL` | your deployment URL, e.g. `https://peacock.vercel.app` (optional — auto-detected from `VERCEL_URL` if omitted) |

Then deploy:

```bash
vercel --prod
```

Notes:
- Share links use `NEXT_PUBLIC_APP_URL`, falling back to Vercel's `VERCEL_URL`,
  then `localhost` (see `lib/url.ts`) — so links are correct even if you don't set
  the variable.
- Use Neon's **pooled** endpoint; serverless functions open many short-lived
  connections, and the pooler handles that gracefully.
- The in-memory rate limiter (`lib/ratelimit.ts`) is per-instance; for serious
  production use back it with Redis (e.g. Upstash). Per-link brute-force lockout is
  in the DB and works across instances regardless.

## Project layout

```
app/
  api/…                 route handlers (auth, notes, shares, share access)
  login, register, notes/new, notes/[id], share/[token]   pages
components/             UI (Navbar, forms, shadcn-style ui/*)
lib/
  db.ts                 pg pool + query() + withTransaction()
  auth.ts               bcrypt + JWT cookie session
  access.ts             ⭐ atomic, race-safe note-access logic
  createShare.ts        share-link creation (token + key)
  share.ts              token/key generation + status computation
  ratelimit.ts          in-memory per-IP limiter
  validation.ts         zod schemas
sql/
  001_init.sql          schema
  999_reset.sql         drop-all (dev)
scripts/seed.ts         demo users
```

## Scripts

```bash
npm run dev        # dev server
npm run build      # production build
npm run start      # serve production build
npm run db:setup   # apply schema
npm run db:seed    # seed demo users
npm run db:reset   # drop + recreate schema
```
