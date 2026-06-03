# CI/CD — Cloudflare Workers Builds

This repo deploys via **Cloudflare Workers Builds** (Cloudflare's native Git
integration), not GitHub Actions. Once connected, every push to `master`
auto-builds and deploys the Worker — no GitHub Actions, no API tokens stored in
GitHub.

## One-time setup (in the Cloudflare dashboard)

1. Go to **Workers & Pages → `astro-monograph-teenybase` → Settings → Builds**.
   (The Worker `astro-monograph-teenybase` already exists from the initial deploy.)
2. Click **Connect** and authorize the **`theserverlessdev/astro-monograph-teenybase`**
   GitHub repository.
3. Configure the build settings:

   | Setting | Value |
   |---|---|
   | **Git branch** | `main` (production) |
   | **Build command** | `npm run build` |
   | **Deploy command** | `npx wrangler deploy` |
   | **Root directory** | `/` (repo root) |
   | **Build variables** | `PUBLIC_DEMO_MODE=1` *(public demo only — see below)* |

4. Save. Push a commit to `main` to trigger the first build.

> **`PUBLIC_DEMO_MODE`** is what makes a build a *demo* build: the DemoBanner +
> exposed credentials and the daily `/internal/reset` cron are emitted only when
> it's set (see `src/lib/demo.ts`, `scripts/postbuild-cron.mjs`). Set it to `1` in
> the dashboard build variables for the public demo Worker. Leave it unset for a
> normal private deployment.

> **Why these values:** the build command produces `dist/` via Astro's Cloudflare
> adapter, and `wrangler deploy` ships it using the bindings in the repo-root
> `wrangler.jsonc` (D1 `astro-monograph-teenybase-db`, R2 `astro-monograph-teenybase-files`, KV `SESSION`). The
> `name` in `wrangler.jsonc` is `astro-monograph-teenybase`, which **must** match the Worker name
> in the dashboard — it does.

## What Workers Builds handles vs. what it doesn't

- **Does:** install deps, run the build, and `wrangler deploy` on every push.
- **Does not:** apply D1 migrations or set secrets. Those are deploy-time-once
  concerns:
  - **Migrations** live in `blog-backend/migrations/` (committed). They've already
    been applied to the remote `astro-monograph-teenybase-db`. When you add a new table/column, run
    `npx wrangler d1 migrations apply astro-monograph-teenybase-db --remote` locally before (or after)
    the push. If you'd rather automate it, change the **Deploy command** to:
    `npx wrangler d1 migrations apply astro-monograph-teenybase-db --remote --yes && npx wrangler deploy`
  - **Secrets** (`JWT_SECRET`, `JWT_SECRET_USERS`, `ADMIN_JWT_SECRET`,
    `ADMIN_SERVICE_TOKEN`, `POCKET_UI_EDITOR_PASSWORD`, `RESET_TOKEN`) are already
    set on the Worker and persist across builds. Manage them in **Settings →
    Variables and Secrets**. `RESET_TOKEN` guards the daily demo reset
    (`/internal/reset`).

## Preview deployments (optional)

Workers Builds can also build **non-production branches** and pull requests to a
preview URL. Enable it under **Settings → Builds → Build branches** if you want a
preview per PR. Unlike the old Surge preview (which only served static shells),
these previews run the full SSR Worker against the same bindings.

## Rolling back

In **Workers & Pages → `astro-monograph-teenybase` → Deployments**, every build is listed; use
**Rollback** to revert to a previous version instantly.

## Local / manual deploy (still works)

Nothing here removes the manual path. From the repo root, with
`CLOUDFLARE_API_TOKEN` set (or `wrangler login`):

```bash
npx wrangler deploy            # build output must exist (npm run build first)
# or the full one-shot for a fresh environment:
npm run setup
```
