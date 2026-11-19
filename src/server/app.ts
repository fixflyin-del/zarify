import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { db, isDatabaseConfigured } from '../db/index.ts';
import { blogs, products } from '../db/schema.ts';
import storefrontRouter from './routes/storefront.ts';
import authRouter from './routes/auth.ts';
import commerceRouter from './routes/commerce.ts';
import adminRouter from './routes/admin.ts';

export function createExpressApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Basic security headers (compatible with AI Studio iframe embedding & Vercel)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Rate limiting on APIs
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  // API Routers
  app.use('/api/auth', authRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api', storefrontRouter);
  app.use('/api', commerceRouter);

  // Dynamic robots.txt
  app.get('/robots.txt', (req, res) => {
    const baseUrl = (
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /account\n\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  // Dynamic XML sitemap.xml
  app.get('/sitemap.xml', async (req, res) => {
    const baseUrl = (
      process.env.APP_URL || `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');
    const staticPaths = [
      '/',
      '/shop',
      '/collections/hijabs',
      '/collections/naqaabs',
      '/collections/dupattas',
      '/about-us',
      '/founder',
      '/contact-us',
      '/blog',
      '/track-order',
      '/faq',
      '/privacy-policy',
      '/terms-and-conditions',
      '/shipping-policy',
      '/return-refund-policy',
      '/cancellation-policy',
    ];

    let dynamicPaths: string[] = [];
    if (isDatabaseConfigured()) {
      try {
        const [prods, posts] = await Promise.all([
          db.select({ slug: products.slug }).from(products).where(eq(products.isActive, true)),
          db.select({ slug: blogs.slug }).from(blogs).where(eq(blogs.isPublished, true)),
        ]);
        dynamicPaths = [
          ...prods.map((p) => `/products/${p.slug}`),
          ...posts.map((b) => `/blog/${b.slug}`),
        ];
      } catch {
        // Fall back to static paths if DB is cold
      }
    }

    const urls = [...staticPaths, ...dynamicPaths]
      .map(
        (p) =>
          `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <changefreq>${p === '/' ? 'daily' : 'weekly'}</changefreq>\n  </url>`
      )
      .join('\n');

    res
      .type('application/xml')
      .send(
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`
      );
  });

  return app;
}
