import { useEffect } from 'react';

const SITE_NAME = 'Cactus Clans';
const BASE_URL = 'https://www.cactusclans.co.uk';
const DEFAULT_IMAGE = `${BASE_URL}/logo.png`;

interface SeoMeta {
  title: string;
  description: string;
  /** Canonical path, e.g. "/" or "/shop". Defaults to the current page path. */
  path?: string;
  /** Absolute URL to the OG image. Defaults to the logo. */
  image?: string;
}

function setMeta(name: string, content: string, isProperty = false) {
  const attr = isProperty ? 'property' : 'name';
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function setLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

/**
 * Updates the document title, meta description, canonical URL, and Open Graph /
 * Twitter card tags for the current page. Use this in every public-facing screen.
 */
export function useSeoMeta({ title, description, path, image }: SeoMeta) {
  useEffect(() => {
    const fullTitle = `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    const canonicalPath = path ?? window.location.pathname;
    const normalizedPath = canonicalPath.replace(/\/$/, '');
    const canonicalUrl = normalizedPath ? `${BASE_URL}${normalizedPath}` : BASE_URL;
    const ogImage = image ?? DEFAULT_IMAGE;

    setMeta('description', description);

    // Canonical
    setLink('canonical', canonicalUrl);

    // Open Graph
    setMeta('og:type', 'website', true);
    setMeta('og:site_name', SITE_NAME, true);
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', description, true);
    setMeta('og:url', canonicalUrl, true);
    setMeta('og:image', ogImage, true);

    // Twitter card
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', description);
    setMeta('twitter:image', ogImage);
  }, [title, description, path, image]);
}
