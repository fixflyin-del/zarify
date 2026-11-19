import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import adminPinRouter from './routes/adminPin.ts';
import utilitiesRouter from './routes/utilities.ts';

export function createExpressApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));
  app.use(cookieParser());

  // Security headers compatible with AI Studio iframe & Vercel
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // General API rate limiter
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  // Firebase-verified Admin PIN gate + utility endpoints
  app.use('/api/admin-security', adminPinRouter);
  app.use('/api', utilitiesRouter);

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
  app.get('/sitemap.xml', (req, res) => {
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

    const urls = staticPaths
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
