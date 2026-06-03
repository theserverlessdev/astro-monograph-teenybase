// Demo database reset.
//
// This deployment is a public, editable demo (anyone can sign in to /admin), so
// a Cloudflare Cron Trigger calls this every 24h to wipe whatever visitors did
// and restore the "factory" state:
//   1. drop all rows from the app tables (content, posts, links, users),
//   2. recreate the well-known demo admin user,
//   3. re-seed every site section from the committed YAML (src/data),
//   4. re-seed one welcome blog post and one link.
//
// It runs in-process against the same Worker bindings: data wipes go straight to
// D1, and everything that needs password hashing / row-level rules goes through
// the teenybase API (the same in-Worker Hono app the site already mounts).
//
// Triggered from the Worker's scheduled() handler (added by
// scripts/postbuild-cron.mjs) and exposed for manual runs at POST /internal/reset
// (token-guarded — see src/pages/internal/reset.ts).
import { env } from 'cloudflare:workers';
import { getTeenyApp } from './teeny';
import { yamlBaseline } from '../lib/content';
import { DEMO } from '../lib/demo';

const NOOP_CTX = { waitUntil() {}, passThroughOnException() {} };

function appUrl(): string {
  return String((env as any).APP_URL || 'https://astro-monograph-teenybase.theserverless.dev').replace(/\/$/, '');
}

function demoCreds() {
  const e = env as any;
  return {
    email: e.DEMO_EMAIL || DEMO.email,
    password: e.DEMO_PASSWORD || DEMO.password,
    username: e.DEMO_USERNAME || DEMO.username,
    name: e.DEMO_NAME || DEMO.name,
  };
}

// One in-process call into the teenybase Hono app. Origin matches appUrl so the
// CSRF guard accepts writes; bindings come from `cloudflare:workers` env.
async function call(
  path: string,
  { method = 'GET', token, body }: { method?: string; token?: string; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; json: any; text: string }> {
  const base = appUrl();
  const req = new Request(`${base}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Origin: base,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await getTeenyApp().fetch(req, env as any, NOOP_CTX as any);
  const text = await res.text();
  let json: any;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  return { ok: res.ok, status: res.status, json, text };
}

async function wipe(): Promise<void> {
  const db = (env as any).PRIMARY_DB;
  if (!db) throw new Error('PRIMARY_DB binding missing');
  // Order doesn't matter (no ON DELETE actions), but clear children first anyway.
  for (const table of ['posts', 'links', 'content', 'users']) {
    try { await db.prepare(`DELETE FROM ${table}`).run(); } catch { /* table may not exist yet */ }
  }
}

const WELCOME_POST = {
  title: 'Welcome to the Astro Monograph demo',
  slug: 'welcome',
  excerpt: 'A single-page Astro portfolio with a built-in CMS, blog, and links feed — all on one Cloudflare Worker, backed by teenybase (D1 + R2).',
  tags: ['astro', 'teenybase', 'cloudflare'],
  body: [
    "You're looking at the live demo of **Astro Monograph (teenybase edition)**.",
    '',
    'Everything on this site — the hero, about, experience, projects, skills,',
    'education and contact sections, plus the colors, fonts, this blog, and the',
    'links feed — is editable from the **/admin** panel. No code, no redeploys:',
    'edits save as drafts, you preview them, then publish.',
    '',
    '## How it works',
    '',
    '- **Astro SSR** renders the site and reads published content straight from',
    '  **Cloudflare D1** during render.',
    '- **[teenybase](https://teenybase.com)** provides the API, auth, and admin —',
    '  mounted at `/api/*` inside the *same* Worker, sharing one D1 database and',
    '  one R2 bucket.',
    '- The committed `src/data/*.yaml` is the seed and the fallback, so a fresh',
    '  clone always renders even before the database is seeded.',
    '',
    '## Try it',
    '',
    'Open the **admin** (linked at the bottom of the page), sign in with the demo',
    'credentials shown there, and change anything you like. This is a shared',
    'sandbox, so the database **resets every 24 hours** — your edits are temporary.',
  ].join('\n'),
};

const WELCOME_LINK = {
  title: 'teenybase — a single-file backend on Cloudflare',
  url: 'https://teenybase.com',
  kind: 'bookmark',
  note: 'The backend powering this demo: a D1-backed REST API, JWT auth with row-level rules, R2 uploads, and an admin — all from one config file.',
  tags: ['cloudflare', 'teenybase'],
};

/**
 * Run the full demo reset. Returns a short human-readable summary. Safe to call
 * repeatedly; each run fully rebuilds the demo state.
 */
export async function resetDemo(): Promise<string> {
  const log: string[] = [];
  const serviceToken = (env as any).ADMIN_SERVICE_TOKEN as string | undefined;
  const creds = demoCreds();

  // 1. Make sure teenybase's internal tables exist (no-op if already set up).
  await call('/api/v1/setup-db', { method: 'POST', token: serviceToken, body: {} }).catch(() => {});

  // 2. Wipe all visitor-editable data.
  await wipe();
  log.push('wiped content/posts/links/users');

  // 3. Recreate the demo admin user (service token bypasses the closed signup rule).
  let userId: string | undefined;
  const signup = await call('/api/v1/table/users/auth/sign-up', {
    method: 'POST', token: serviceToken,
    body: {
      username: creds.username,
      email: creds.email,
      password: creds.password,
      passwordConfirm: creds.password,
      name: creds.name,
    },
  });
  userId = signup.json?.record?.id || signup.json?.user?.id || signup.json?.id;
  log.push(`demo user ${signup.ok ? 'created' : `signup ${signup.status}`}`);

  // 4. Log in as the demo user — needed to write content (auth.uid != null) and to
  //    own the seeded post/link.
  const login = await call('/api/v1/table/users/auth/login-password', {
    method: 'POST', body: { email: creds.email, password: creds.password },
  });
  const token = login.json?.token || login.json?.accessToken || login.json?.access_token;
  userId = userId || login.json?.record?.id || login.json?.id;
  if (!token) {
    log.push(`login failed (${login.status})`);
    return log.join('; ');
  }

  // 5. Seed every site section from the committed YAML.
  const baseline = yamlBaseline();
  let seeded = 0;
  for (const [section, data] of Object.entries(baseline)) {
    if (section.startsWith('__')) continue;
    const json = JSON.stringify(data);
    const r = await call('/api/v1/table/content/insert', {
      method: 'POST', token, body: { values: { section, draft: json, published: json } },
    });
    if (r.ok) seeded++;
  }
  log.push(`seeded ${seeded} sections`);

  // 6. Seed the welcome post + one link (best-effort).
  if (userId) {
    const post = await call('/api/v1/table/posts/insert', {
      method: 'POST', token,
      body: {
        values: {
          author_id: userId,
          title: WELCOME_POST.title,
          slug: WELCOME_POST.slug,
          excerpt: WELCOME_POST.excerpt,
          body: WELCOME_POST.body,
          tags: JSON.stringify(WELCOME_POST.tags),
          published: true,
          published_at: new Date().toISOString(),
          ai_generated: true,
        },
      },
    });
    log.push(`post ${post.ok ? 'seeded' : `failed ${post.status}`}`);

    const link = await call('/api/v1/table/links/insert', {
      method: 'POST', token,
      body: {
        values: {
          author_id: userId,
          title: WELCOME_LINK.title,
          url: WELCOME_LINK.url,
          kind: WELCOME_LINK.kind,
          note: WELCOME_LINK.note,
          tags: JSON.stringify(WELCOME_LINK.tags),
          published: true,
          published_at: new Date().toISOString(),
        },
      },
    });
    log.push(`link ${link.ok ? 'seeded' : `failed ${link.status}`}`);
  }

  return log.join('; ');
}
