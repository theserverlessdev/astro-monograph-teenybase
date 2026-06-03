// Public demo configuration.
//
// This deployment (astro-monograph-teenybase.theserverless.dev) is a LIVE,
// PUBLIC demo of the Astro Monograph theme + teenybase admin. The admin login is
// intentionally exposed so anyone can sign in and try editing the site. To keep
// it safe and self-healing:
//   - the credentials below are well-known and shown on the site (DemoBanner)
//     and on the /admin login screen,
//   - a Cloudflare Cron Trigger resets the database every 24h (see
//     src/server/reset.ts), wiping any edits and recreating this same user.
//
// On the server, scripts/setup.mjs and src/server/reset.ts may override these
// via the DEMO_EMAIL / DEMO_PASSWORD / DEMO_USERNAME / DEMO_NAME env vars; if you
// change them there, change them here too so the on-screen hints stay accurate.
export const DEMO = {
  email: 'demo@example.com',
  password: 'monograph-demo',
  username: 'demo',
  name: 'Demo Admin',
} as const;
