import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq } from 'drizzle-orm';
import { db } from './src/db/index.ts';
import { blogs, products } from './src/db/schema.ts';
import storefrontRouter from './src/server/routes/storefront.ts';
import authRouter from './src/server/routes/auth.ts';
import commerceRouter from './src/server/routes/commerce.ts';
import adminRouter from './src/server/routes/admin.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Basic security headers (compatible with AI Studio iframe embedding)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // Rate limiting on auth and write APIs
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
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    res.type('text/plain').send(
      `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /account\n\nSitemap: ${baseUrl}/sitemap.xml\n`
    );
  });

  // Dynamic XML sitemap.xml
  app.get('/sitemap.xml', async (req, res) => {
    const baseUrl = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
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

    const urls = [...staticPaths, ...dynamicPaths]
      .map(
        (p) =>
          `  <url>\n    <loc>${baseUrl}${p}</loc>\n    <changefreq>${p === '/' ? 'daily' : 'weekly'}</changefreq>\n  </url>`
      )
      .join('\n');

    res
      .type('application/xml')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`);
  });

  // Vite middleware in development, static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ZARIFLY server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
