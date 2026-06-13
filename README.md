# Astro Monograph — teenybase edition

A single-page Astro portfolio that is **fully self-editable**: every section, the
colors, the fonts, a Markdown **blog**, and a **links feed** are managed from a
built-in `/admin`, with no code changes and no redeploys. Astro SSR and a
[teenybase](https://teenybase.com) backend run inside **one Cloudflare Worker**,
sharing a single D1 database and R2 bucket.

**[Live demo → astro-monograph-teenybase.theserverless.dev](https://astro-monograph-teenybase.theserverless.dev)** — sign in to the admin and edit content, colors, fonts, blog posts and links live.

> This is the dynamic, CMS-backed evolution of the static
> [Astro Monograph](https://github.com/theserverlessdev/astro-monograph) theme.
> See the [meta blog post on the live demo](https://astro-monograph-teenybase.theserverless.dev/blog/using-the-cms)
> for a tour of the CMS and how the single-Worker architecture fits together.
>
> The public demo (banner, exposed credentials, daily database reset) lives on the
> [`demo` branch](https://github.com/theserverlessdev/astro-monograph-teenybase/tree/demo);
> `main` is the clean template.

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
- **Project detail pages** at `/projects/<slug>` (optional Markdown write-up per
  project), a print-ready **`/cv`** résumé generated from the same content, and
  **edge-generated Open Graph cards** for every page (`/og/*.png`, via satori +
  resvg) so shared links look like the site.

```
src/
├── components/      # Hero, About, Experience, Projects, Skills, Education,
│                    # Contact, Footer, BlogTeaser, LinksTeaser, CustomSections
├── data/            # YAML seed + fallback content (edit or seed into D1)
├── layouts/         # BaseLayout (SEO/theme), PageLayout (sub-page chrome)
├── lib/             # data loader, content (D1↔YAML), blog, links, rss, slug, og, admin SPA
├── pages/           # index, blog/, links, cv, projects/[slug], admin/,
│                    # api/[...path], og/[...path], rss.xml, links.xml,
│                    # sitemap.xml, llms.txt, robots.txt
├── server/          # teeny.ts (mounts teenybase inside the Worker)
└── styles/          # global.css (Tailwind theme + animations)
blog-backend/        # teenybase config + generated D1 migrations + seed scripts
scripts/             # setup.mjs, seed-content.mjs
```

## Run it yourself

You need a (free) Cloudflare account and Node 18+.

```bash
git clone https://github.com/theserverlessdev/astro-monograph-teenybase
cd astro-monograph-teenybase
npm install
npx wrangler login

# Provisions D1 + R2, applies migrations, sets secrets, deploys, creates your
# admin user, and seeds content. Prints your live URL + credentials.
npm run setup
```

`npm run setup` (see `scripts/setup.mjs`) is idempotent and prints your admin
login at the end (override with `ADMIN_EMAIL=you@example.com ADMIN_PASSWORD=…`).

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

## Continuous deployment

Pushes to the default branch auto-build and deploy via **Cloudflare Workers
Builds** (no GitHub Actions). See [`blog-backend/CI-CD.md`](blog-backend/CI-CD.md)
for the one-time dashboard connection steps.

## License

MIT — see [LICENSE](LICENSE). Built with [Astro](https://astro.build),
[Tailwind CSS](https://tailwindcss.com), [teenybase](https://teenybase.com), and
icons by [Lord Icon](https://lordicon.com).
