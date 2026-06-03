# Astro Monograph — teenybase edition

A single-page Astro portfolio that is **fully self-editable**: every section, the
colors, the fonts, a Markdown **blog**, and a **links feed** are managed from a
built-in `/admin`, with no code changes and no redeploys. Astro SSR and a
[teenybase](https://teenybase.com) backend run inside **one Cloudflare Worker**,
sharing a single D1 database and R2 bucket.

**[Live demo → astro-monograph-teenybase.theserverless.dev](https://astro-monograph-teenybase.theserverless.dev)**

The demo's admin is open for anyone to try:

| | |
|---|---|
| **Admin** | [/admin](https://astro-monograph-teenybase.theserverless.dev/admin) |
| **Email** | `demo@example.com` |
| **Password** | `monograph-demo` |

Sign in and edit anything — content, colors, fonts, blog posts, links. It's a
shared sandbox, so a Cloudflare Cron Trigger **resets the database every 24 hours**;
your edits are temporary.

> This is the dynamic, CMS-backed evolution of the static
> [Astro Monograph](https://github.com/theserverlessdev/astro-monograph) theme.
> See the [meta blog post on the live demo](https://astro-monograph-teenybase.theserverless.dev/blog/welcome)
> for a tour of the CMS and how the single-Worker architecture fits together.

## How it works

- **Astro SSR** renders the site and reads the *published* content for each
  section straight from **Cloudflare D1** during render (no HTTP round-trip).
- **teenybase** provides the REST API, JWT auth with row-level rules, R2 file
  uploads, and the admin — mounted at `/api/*` inside the same Worker
  (`src/server/teeny.ts`, `src/pages/api/[...path].ts`).
- The committed `src/data/*.yaml` is both the **seed** and the **fallback**, so a
  fresh clone always renders even before the database is seeded
  (`src/lib/content.ts`).
- Edits in `/admin` save as **drafts**; you **Preview**, then **Publish**
  (publish copies `draft` → `published`).

```
src/
├── components/      # Hero, About, Experience, Projects, Skills, Education,
│                    # Contact, Footer, BlogTeaser, LinksTeaser, CustomSections,
│                    # DemoBanner
├── data/            # YAML seed + fallback content (edit or seed into D1)
├── layouts/         # BaseLayout (SEO/theme), PageLayout (sub-page chrome)
├── lib/             # data loader, content (D1↔YAML), blog, links, rss, admin SPA
├── pages/           # index, blog/, links, admin/, api/[...path], internal/reset,
│                    # rss.xml, links.xml, sitemap.xml, llms.txt, robots.txt
├── server/          # teeny.ts (mount teenybase), reset.ts (daily demo reset)
└── styles/          # global.css (Tailwind theme + animations)
blog-backend/        # teenybase config + generated D1 migrations + seed scripts
scripts/             # setup.mjs, seed-content.mjs, postbuild-cron.mjs
```

## Run it yourself

You need a (free) Cloudflare account and Node 18+.

```bash
git clone https://github.com/theserverlessdev/astro-monograph-teenybase
cd astro-monograph-teenybase
npm install
npx wrangler login

# Provisions D1 + R2, applies migrations, sets secrets, deploys, creates the
# demo admin user, and seeds content. Prints your live URL + credentials.
npm run setup
```

`npm run setup` (see `scripts/setup.mjs`) is idempotent. By default it creates the
public demo admin (`demo@example.com` / `monograph-demo`). For a **private**
deployment, override the account: `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=… npm run setup`.

**Custom domain** (must be a zone on your Cloudflare account):

```bash
DOMAIN=yourdomain.com npm run setup
```

To re-seed content from YAML after editing it: `npm run seed:content` (add
`-- --force` to overwrite existing sections).

### Local development

```bash
npm install
cp blog-backend/.dev.vars.example .dev.vars   # then edit
npm run dev
```

## The 24-hour demo reset

Because the admin is public, the database is rebuilt daily so the demo stays
clean and self-healing:

- A **Cloudflare Cron Trigger** (`triggers.crons` in `wrangler.jsonc`) fires the
  Worker's `scheduled()` handler.
- The adapter owns the Worker entry, so `scripts/postbuild-cron.mjs` runs after
  `astro build` to wrap the generated entry with a `scheduled()` handler and inject
  the cron into the deploy config.
- `scheduled()` POSTs to `/internal/reset` (guarded by the `RESET_TOKEN` secret),
  which runs `resetDemo()` in `src/server/reset.ts`: wipe the app tables, recreate
  the demo admin user, and re-seed content + a welcome post + a link.

Trigger a reset by hand:

```bash
curl -X POST https://astro-monograph-teenybase.theserverless.dev/internal/reset \
  -H "x-reset-token: $RESET_TOKEN"
```

## Continuous deployment

Pushes to the default branch auto-build and deploy via **Cloudflare Workers
Builds** (no GitHub Actions). See [`blog-backend/CI-CD.md`](blog-backend/CI-CD.md)
for the one-time dashboard connection steps.

## License

MIT — see [LICENSE](LICENSE). Built with [Astro](https://astro.build),
[Tailwind CSS](https://tailwindcss.com), [teenybase](https://teenybase.com), and
icons by [Lord Icon](https://lordicon.com).
