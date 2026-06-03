// llms.txt — a concise, link-rich summary for language models (the "AI SEO"
// counterpart to robots.txt/sitemap). Reads from the live CMS so it reflects
// whatever is currently published.
import type { APIRoute } from 'astro';
import { getContent } from '../lib/content';
import { listPosts } from '../lib/blog';

export const prerender = false;

const stripHtml = (s: string) =>
  String(s ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export const GET: APIRoute = async (ctx) => {
  const content = await getContent(ctx);
  const site = content.site || {};
  const hero = content.hero || {};

  const name = site.fullName || site.name;
  const posts = await listPosts((ctx.locals as any)?.cfContext, 10).catch(() => []);

  const lines = [
    `# ${name}`,
    '',
    hero.description ? `> ${stripHtml(hero.description)}` : '',
    '',
    `- Site: https://astro-monograph-teenybase.theserverless.dev`,
    site.email ? `- Email: ${site.email}` : '',
    ...(site.social || []).map((s: any) => `- ${s.label}: ${s.url}`),
    '',
    `## Pages`,
    '',
    `- [Home](https://astro-monograph-teenybase.theserverless.dev/): about, experience, projects, skills, education`,
    `- [Blog](https://astro-monograph-teenybase.theserverless.dev/blog): writing on engineering and infrastructure ([RSS](https://astro-monograph-teenybase.theserverless.dev/rss.xml))`,
    `- [Links](https://astro-monograph-teenybase.theserverless.dev/links): shared articles and videos ([RSS](https://astro-monograph-teenybase.theserverless.dev/links.xml))`,
    '',
    `## About`,
    '',
    `${name} is the live demo of Astro Monograph (teenybase edition) — a single-page Astro portfolio whose every section, plus a blog and links feed, is editable from a built-in /admin panel backed by teenybase on a single Cloudflare Worker (D1 + R2). This is placeholder demo content; the database resets every 24 hours.`,
    '',
  ];

  if (posts.length) {
    lines.push(`## Recent posts`, '');
    posts.slice(0, 10).forEach((p) => lines.push(`- [${p.title}](https://astro-monograph-teenybase.theserverless.dev/blog/${p.slug})`));
    lines.push('');
  }

  lines.push(`## Full content`, '', `For the complete site content as plain text, see https://astro-monograph-teenybase.theserverless.dev/llms-full.txt`);

  return new Response(lines.filter((l) => l !== undefined).join('\n'), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=600' },
  });
};
