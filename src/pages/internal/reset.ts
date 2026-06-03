// Token-guarded endpoint that rebuilds the demo database (see src/server/reset.ts).
//
// Called once a day by the Worker's scheduled() handler (wired in
// scripts/postbuild-cron.mjs), which passes the RESET_TOKEN secret in the
// `x-reset-token` header. Also runnable by hand:
//
//   curl -X POST https://astro-monograph-teenybase.theserverless.dev/internal/reset \
//        -H "x-reset-token: <RESET_TOKEN>"
//
// Returns 403 unless RESET_TOKEN is set on the Worker and the header matches, so
// the public can never trigger it.
export const prerender = false;

import { env } from 'cloudflare:workers';
import type { APIRoute } from 'astro';
import { resetDemo } from '../../server/reset';

export const POST: APIRoute = async ({ request }) => {
  const expected = (env as any).RESET_TOKEN as string | undefined;
  const provided = request.headers.get('x-reset-token') || '';
  if (!expected || provided !== expected) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const summary = await resetDemo();
    return new Response(JSON.stringify({ ok: true, summary }), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
