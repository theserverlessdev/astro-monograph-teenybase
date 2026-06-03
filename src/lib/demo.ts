// Public demo configuration.
//
// Demo mode is OFF by default — a fresh clone is just a normal portfolio with a
// private admin. It is turned on only for the public demo deployment
// (astro-monograph-teenybase.theserverless.dev) by setting the build-time env var
// PUBLIC_DEMO_MODE=1. When on:
//   - the site shows a DemoBanner with these (intentionally public) credentials
//     and the /admin login pre-fills them,
//   - the build wires a Cloudflare Cron Trigger that resets the database every
//     24h (scripts/postbuild-cron.mjs + src/server/reset.ts), wiping edits and
//     recreating this same user.
//
// When off, none of the above is emitted: no banner, no exposed credentials, and
// no scheduled reset.
//
// On the server, scripts/setup.mjs and src/server/reset.ts may override the
// credentials via DEMO_EMAIL / DEMO_PASSWORD / DEMO_USERNAME / DEMO_NAME; if you
// change them there, change them here too so the on-screen hints stay accurate.

// Build-time switch. Vite inlines PUBLIC_* env vars, so this is a constant that
// dead-code-eliminates the demo UI from non-demo builds.
export const DEMO_MODE =
  import.meta.env.PUBLIC_DEMO_MODE === '1' || import.meta.env.PUBLIC_DEMO_MODE === 'true';

export const DEMO = {
  email: 'demo@example.com',
  password: 'monograph-demo',
  username: 'demo',
  name: 'Demo Admin',
} as const;
