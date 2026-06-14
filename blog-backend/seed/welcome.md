---
title: "Welcome to the Astro Monograph demo"
slug: "welcome"
excerpt: "A single-page Astro portfolio with a built-in CMS, blog, and links feed — all on one Cloudflare Worker, backed by teenybase (D1 + R2)."
tags: ["astro", "teenybase", "cloudflare"]
published: true
ai_generated: true
---

You're looking at the live demo of **Astro Monograph (teenybase edition)**.

Everything on this site — the hero, about, experience, projects, skills,
education and contact sections, plus the colors, fonts, this blog, and the links
feed — is editable from the **/admin** panel. No code, no redeploys: edits save
as drafts, you preview them, then publish.

## How it works

- **Astro SSR** renders the site and reads published content straight from
  **Cloudflare D1** during render.
- **[teenybase](https://teenybase.com)** provides the API, auth, and admin —
  mounted at `/api/*` inside the *same* Worker, sharing one D1 database and one
  R2 bucket.
- The committed `src/data/*.yaml` is the seed and the fallback, so a fresh clone
  always renders even before the database is seeded.

## Try it

Open the **admin** (linked at the bottom of the page), sign in with the demo
credentials shown there, and change anything you like. This is a shared sandbox,
so the database **resets every 24 hours** — your edits are temporary.
