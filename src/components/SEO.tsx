import { useEffect } from 'react';

interface SEOProps {
  title: string;
  description: string;
  canonicalPath?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function SEO({
  title,
  description,
  canonicalPath,
  image,
  type = 'website',
  jsonLd,
}: SEOProps) {
  useEffect(() => {
    document.title = title;

    const setMeta = (selector: string, attr: 'name' | 'property', key: string, value: string) => {
      let el = document.head.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, key);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    const fullUrl =
      window.location.origin + (canonicalPath || window.location.pathname);

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', type);
    setMeta('meta[property="og:url"]', 'property', 'og:url', fullUrl);
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    if (image) {
      const absImg = image.startsWith('http') ? image : `${window.location.origin}${image}`;
      setMeta('meta[property="og:image"]', 'property', 'og:image', absImg);
    }

    let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', fullUrl);

    const existingScript = document.getElementById('zarifly-page-jsonld');
    if (existingScript) existingScript.remove();

    if (jsonLd) {
      const script = document.createElement('script');
      script.id = 'zarifly-page-jsonld';
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(script);
    }

    return () => {
      const s = document.getElementById('zarifly-page-jsonld');
      if (s) s.remove();
    };
  }, [title, description, canonicalPath, image, type, jsonLd]);

  return null;
}
