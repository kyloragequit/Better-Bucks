import { useEffect } from "react";

const SITE_NAME = "Better Bucks";
const SITE_URL = "https://betterbucks.net";
const DEFAULT_OG_IMAGE = "/favicon.png";

interface PageSEOProps {
  title: string;
  description: string;
  canonicalPath?: string;
  ogImage?: string;
  ogType?: "website" | "article";
  twitterCard?: "summary" | "summary_large_image";
  keywords?: string;
  noindex?: boolean;
  jsonLd?: object | object[];
}

function setMeta(attr: string, attrName: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${attrName}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, attrName);
    document.head.appendChild(el);
  }
  el.content = content;
}

function removeMeta(attr: string, attrName: string) {
  const el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${attrName}"]`);
  if (el) el.remove();
}

function setCanonical(href: string) {
  let el = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!el) {
    el = document.createElement("link");
    el.rel = "canonical";
    document.head.appendChild(el);
  }
  el.href = href;
}

function setJsonLd(data: object | object[]) {
  const id = "page-json-ld";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(
    Array.isArray(data) ? { "@context": "https://schema.org", "@graph": data } : data
  );
}

function removeJsonLd() {
  const el = document.getElementById("page-json-ld");
  if (el) el.remove();
}

export function PageSEO({
  title,
  description,
  canonicalPath = "/",
  ogImage = DEFAULT_OG_IMAGE,
  ogType = "website",
  twitterCard = "summary",
  keywords,
  noindex = false,
  jsonLd,
}: PageSEOProps) {
  useEffect(() => {
    const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;
    const absoluteOgImage = ogImage.startsWith("http") ? ogImage : `${SITE_URL}${ogImage}`;

    document.title = fullTitle;

    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    if (keywords) {
      setMeta("name", "keywords", keywords);
    } else {
      removeMeta("name", "keywords");
    }

    setCanonical(canonicalUrl);

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:type", ogType);
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:image", absoluteOgImage);
    setMeta("property", "og:image:alt", ogType === "article" ? title : "Better Bucks logo");
    setMeta("property", "og:site_name", SITE_NAME);

    setMeta("name", "twitter:card", twitterCard);
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", absoluteOgImage);
    setMeta("name", "twitter:image:alt", ogType === "article" ? title : "Better Bucks logo");

    if (jsonLd) {
      setJsonLd(jsonLd);
    } else {
      removeJsonLd();
    }

    return () => {
      removeJsonLd();
    };
  }, [title, description, canonicalPath, ogImage, ogType, twitterCard, keywords, noindex, jsonLd]);

  return null;
}
