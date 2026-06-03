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
// The seeded blog posts are the committed Markdown files (with front-matter),
// inlined at build via Vite's ?raw so they ship inside the Worker.
import welcomeMd from '../../blog-backend/seed/welcome.md?raw';
import tourMd from '../../blog-backend/seed/using-the-cms.md?raw';

const NOOP_CTX = { waitUntil() {}, passThroughOnException() {} };

// Minimal front-matter parser (mirrors blog-backend/seed/seed.mjs): splits the
// `--- meta --- body` Markdown into a post record.
function parsePost(raw: string): { title: string; slug: string; excerpt: string; body: string; tags: string[]; ai_generated: boolean } {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  const meta: Record<string, any> = {};
  if (m) {
    for (const line of m[1].split('\n')) {
      const mm = line.match(/^(\w+):\s*(.*)$/);
      if (!mm) continue;
      let [, k, v] = mm;
      v = v.trim();
      if (v.startsWith('[')) { try { meta[k] = JSON.parse(v); } catch { meta[k] = []; } }
      else if (v === 'true' || v === 'false') meta[k] = v === 'true';
      else meta[k] = v.replace(/^"(.*)"$/, '$1');
    }
  }
  return {
    title: meta.title || 'Untitled',
    slug: meta.slug || 'post',
    excerpt: meta.excerpt || '',
    body: (m ? m[2] : raw).trim(),
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    ai_generated: meta.ai_generated ?? false,
  };
}

// Newest last → seeded last → highest published_at, so it sorts to the top.
const SEED_POSTS = [parsePost(welcomeMd), parsePost(tourMd)];

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

  // 6. Seed the blog posts (from the committed Markdown) + one link (best-effort).
  if (userId) {
    let posts = 0;
    // Space published_at apart so ordering is stable (last file = newest).
    for (let i = 0; i < SEED_POSTS.length; i++) {
      const p = SEED_POSTS[i];
      const r = await call('/api/v1/table/posts/insert', {
        method: 'POST', token,
        body: {
          values: {
            author_id: userId,
            title: p.title,
            slug: p.slug,
            excerpt: p.excerpt,
            body: p.body,
            tags: JSON.stringify(p.tags),
            published: true,
            published_at: new Date(Date.now() + i * 1000).toISOString(),
            ai_generated: p.ai_generated,
          },
        },
      });
      if (r.ok) posts++;
    }
    log.push(`seeded ${posts}/${SEED_POSTS.length} posts`);

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
