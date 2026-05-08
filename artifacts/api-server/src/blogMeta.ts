import { db } from "./db";
import { blogPosts } from "@workspace/db";
import { eq } from "drizzle-orm";

const SITE_URL = "https://betterbucks.net";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function getBlogPostBySlug(slug: string) {
  const [post] = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));
  return post ?? null;
}

export function injectBlogMeta(
  html: string,
  post: {
    title: string;
    excerpt: string;
    slug: string;
    imageUrl: string;
    authorName: string;
    publishedAt: Date | null;
    createdAt: Date | null;
  }
): string {
  const title = `${post.title} – Better Bucks Blog`;
  const description = post.excerpt;
  const canonicalUrl = `${SITE_URL}/blog/${post.slug}`;
  const rawImg = post.imageUrl || "";
  const imageUrl = rawImg.startsWith("http")
    ? rawImg
    : rawImg
    ? `${SITE_URL}${rawImg}`
    : `${SITE_URL}/favicon.png`;

  let result = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta\s+name="description"\s+content=")[^"]*(")/,        `$1${esc(description)}$2`)
    .replace(/(<meta\s+property="og:title"\s+content=")[^"]*(")/,       `$1${esc(title)}$2`)
    .replace(/(<meta\s+property="og:description"\s+content=")[^"]*(")/,  `$1${esc(description)}$2`)
    .replace(/(<meta\s+property="og:url"\s+content=")[^"]*(")/,         `$1${canonicalUrl}$2`)
    .replace(/(<meta\s+property="og:image"\s+content=")[^"]*(")/,       `$1${imageUrl}$2`)
    .replace(/(<meta\s+property="og:image:alt"\s+content=")[^"]*(")/,   `$1${esc(title)}$2`)
    .replace(/(<meta\s+property="og:type"\s+content=")[^"]*(")/,        `$1article$2`)
    .replace(/(<meta\s+name="twitter:card"\s+content=")[^"]*(")/,       `$1summary_large_image$2`)
    .replace(/(<meta\s+name="twitter:title"\s+content=")[^"]*(")/,      `$1${esc(title)}$2`)
    .replace(/(<meta\s+name="twitter:description"\s+content=")[^"]*(")/,`$1${esc(description)}$2`)
    .replace(/(<meta\s+name="twitter:image"\s+content=")[^"]*(")/,      `$1${imageUrl}$2`)
    .replace(/(<meta\s+name="twitter:image:alt"\s+content=")[^"]*(")/,  `$1${esc(title)}$2`)
    .replace(/(<link\s+rel="canonical"\s+href=")[^"]*(")/,              `$1${canonicalUrl}$2`);

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    image: imageUrl,
    url: canonicalUrl,
    author: { "@type": "Person", name: post.authorName },
    publisher: { "@id": `${SITE_URL}/#organization` },
    datePublished: (post.publishedAt ?? post.createdAt ?? new Date()).toISOString(),
  };

  result = result.replace(
    "</head>",
    `  <script type="application/ld+json">${JSON.stringify(articleJsonLd)}</script>\n  </head>`
  );

  return result;
}
