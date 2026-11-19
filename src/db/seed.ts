import bcrypt from 'bcryptjs';
import { count, eq } from 'drizzle-orm';
import { db } from './index.ts';
import {
  banners,
  blogs,
  categories,
  coupons,
  productImages,
  products,
  productVariants,
  reels,
  siteSettings,
  users,
} from './schema.ts';

const IMG = {
  heroHijab: '/src/assets/images/hero_zari_hijab_1795097056066.jpg',
  heroDupatta: '/src/assets/images/hero_royal_dupatta_1795097060130.jpg',
  catHijabs: '/src/assets/images/cat_premium_hijabs_1795097097750.jpg',
  catNaqaabs: '/src/assets/images/cat_elegant_naqaabs_1795097086094.jpg',
  catDupattas: '/src/assets/images/cat_designer_dupattas_1795097061115.jpg',
  craftMacro: '/src/assets/images/craft_zardozi_macro_1795097056186.jpg',
  hijabChocolate: '/src/assets/images/prod_hijab_chocolate_zari_1795097064655.jpg',
  dupattaRose: '/src/assets/images/prod_dupatta_rose_nakashi_1795097080211.jpg',
};

let seedPromise: Promise<void> | null = null;

export function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      console.error('Lazy seed error:', err);
    });
  }
  return seedPromise;
}

async function runSeed() {
  // 1. Ensure bootstrap admin account exists
  const adminEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || 'admin@zarifly.com').toLowerCase();
  const adminPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'ChangeMe@Zarifly2026';
  const existingAdmin = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingAdmin.length === 0) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await db
      .insert(users)
      .values({
        uid: `local-admin-${Date.now()}`,
        email: adminEmail,
        passwordHash: hash,
        fullName: 'Sama Shaikh (Admin)',
        phone: '+91 9619586126',
        role: 'super_admin',
        preferredLang: 'en',
      })
      .onConflictDoNothing();
  }

  // 2. Check if categories already seeded
  const [{ value: catCount }] = await db.select({ value: count() }).from(categories);
  if (catCount > 0) {
    return;
  }

  // Insert the 3 exclusive ZARIFLY categories
  const insertedCategories = await db
    .insert(categories)
    .values([
      {
        slug: 'hijabs',
        name: 'Hijabs',
        nameHi: 'हिजाब',
        description:
          'Handcrafted chiffon, modal silk, and festive Zari & Zardozi embroidered hijabs tailored for graceful drape.',
        descriptionHi:
          'ज़री और ज़रदोज़ी कढ़ाई वाले प्रीमियम शिफॉन और मोडल सिल्क हिजाब।',
        imageUrl: IMG.catHijabs,
        sortOrder: 1,
        seoTitle: 'Premium Handcrafted Hijabs | ZARIFLY Boutique',
        seoDescription:
          'Shop luxury Zari, Zardozi, and Nakashi embroidered hijabs crafted directly by ZARIFLY.',
      },
      {
        slug: 'naqaabs',
        name: 'Naqaabs',
        nameHi: 'नक़ाब',
        description:
          'Breathable Korean Nidha and soft georgette naqaabs finished with delicate hand-beaded trim for all-day comfort.',
        descriptionHi:
          'आरामदायक कोरियन निदा और जॉर्जेट नक़ाब, नाज़ुक हैंडवर्क बॉर्डर के साथ।',
        imageUrl: IMG.catNaqaabs,
        sortOrder: 2,
        seoTitle: 'Elegant Islamic Naqaabs | ZARIFLY Boutique',
        seoDescription:
          'Discover breathable luxury naqaabs crafted with fine Nidha fabrics and subtle artisan detailing.',
      },
      {
        slug: 'dupattas',
        name: 'Dupattas',
        nameHi: 'दुपट्टे',
        description:
          'Heirloom tissue silk and pure organza designer dupattas featuring traditional Indian Nakashi and Zardozi motifs.',
        descriptionHi:
          'पारंपरिक भारतीय नक्काशी और ज़रदोज़ी कढ़ाई वाले डिज़ाइनर टिश्यू सिल्क और ऑर्गेंज़ा दुपट्टे।',
        imageUrl: IMG.catDupattas,
        sortOrder: 3,
        seoTitle: 'Designer Zardozi & Nakashi Dupattas | ZARIFLY Boutique',
        seoDescription:
          'Explore bridal and festive handcrafted dupattas with authentic Indian Zari and Zardozi embroidery.',
      },
    ])
    .returning();

  const catMap = new Map(insertedCategories.map((c) => [c.slug, c.id]));

  // 3. Seed 6 authentic boutique products across the 3 categories (each with 5 square images + colour/size variants)
  const productSeeds = [
    {
      categorySlug: 'hijabs',
      slug: 'noor-e-zari-ivory-chiffon-hijab',
      name: 'Noor-e-Zari Ivory Chiffon Hijab',
      nameHi: 'नूर-ए-ज़री आइवरी शिफॉन हिजाब',
      sku: 'ZRF-HJB-101',
      description:
        'Woven from feather-light matte silk chiffon and finished along the scalloped borders with intricate champagne gold Zari embroidery. Designed for effortless non-slip drape from daylight gatherings to formal evenings.',
      descriptionHi:
        'हल्के मैट सिल्क शिफॉन से तैयार और किनारों पर बारीक शैम्पेन गोल्ड ज़री कढ़ाई से सजा यह हिजाब हर अवसर के लिए उत्तम है।',
      fabric: 'Pure Matte Silk-Chiffon',
      workDetails: 'Hand-guided Antique Gold Zari Scalloped Border',
      sellingPrice: 1490,
      originalPrice: 1890,
      isBestSeller: true,
      isNewArrival: false,
      isFeatured: true,
      images: [
        { url: IMG.catHijabs, colorName: 'Warm Ivory', alt: 'Noor-e-Zari Hijab folded trio showcase' },
        { url: IMG.heroHijab, colorName: 'Champagne Gold', alt: 'Noor-e-Zari draped atelier view' },
        { url: IMG.craftMacro, colorName: 'Warm Ivory', alt: 'Close-up of Zari and pearl embroidery' },
        { url: IMG.hijabChocolate, colorName: 'Dark Chocolate', alt: 'Dark Chocolate variant drape' },
        { url: IMG.catDupattas, colorName: 'Warm Ivory', alt: 'Corner motif detailing' },
      ],
      variants: [
        { sku: 'ZRF-HJB-101-IVR-STD', colorName: 'Warm Ivory', colorHex: '#F3ECE1', sizeName: 'Standard (180×75 cm)', stock: 18, imageUrl: IMG.catHijabs },
        { sku: 'ZRF-HJB-101-IVR-MAX', colorName: 'Warm Ivory', colorHex: '#F3ECE1', sizeName: 'Maxi (200×90 cm)', stock: 12, priceOverride: 1690, imageUrl: IMG.catHijabs },
        { sku: 'ZRF-HJB-101-GLD-STD', colorName: 'Champagne Gold', colorHex: '#D8BE8A', sizeName: 'Standard (180×75 cm)', stock: 15, imageUrl: IMG.heroHijab },
        { sku: 'ZRF-HJB-101-GLD-MAX', colorName: 'Champagne Gold', colorHex: '#D8BE8A', sizeName: 'Maxi (200×90 cm)', stock: 7, priceOverride: 1690, imageUrl: IMG.heroHijab },
        { sku: 'ZRF-HJB-101-CHC-STD', colorName: 'Dark Chocolate', colorHex: '#3B2820', sizeName: 'Standard (180×75 cm)', stock: 10, imageUrl: IMG.hijabChocolate },
      ],
    },
    {
      categorySlug: 'hijabs',
      slug: 'meher-chocolate-zardozi-modal-hijab',
      name: 'Meher Chocolate Zardozi Modal Hijab',
      nameHi: 'मेहर चॉकलेट ज़रदोज़ी मोडल हिजाब',
      sku: 'ZRF-HJB-102',
      description:
        'A rich dark chocolate modal-silk hijab accented with fine antique gold Zardozi paisley borders. Breathable, opaque in a single layer, and crafted in our Mumbai boutique atelier.',
      descriptionHi:
        'गहरे चॉकलेट रंग का मोडल-सिल्क हिजाब, जिस पर पारंपरिक सुनहरी ज़रदोज़ी बेल बनी है। बेहद मुलायम और सांस लेने योग्य कपड़ा।',
      fabric: 'Premium Modal-Silk Blend',
      workDetails: 'Handcrafted Antique Gold Zardozi Paisley Trim',
      sellingPrice: 1790,
      originalPrice: 2290,
      isBestSeller: true,
      isNewArrival: true,
      isFeatured: true,
      images: [
        { url: IMG.hijabChocolate, colorName: 'Dark Chocolate', alt: 'Meher Chocolate Zardozi Hijab on travertine' },
        { url: IMG.craftMacro, colorName: 'Dark Chocolate', alt: 'Macro view of Zardozi threadwork' },
        { url: IMG.catHijabs, colorName: 'Muted Taupe', alt: 'Taupe and Champagne colour study' },
        { url: IMG.heroHijab, colorName: 'Warm Ivory', alt: 'Atelier draped silhouette' },
        { url: IMG.dupattaRose, colorName: 'Dusty Rose', alt: 'Fine weave & border finish' },
      ],
      variants: [
        { sku: 'ZRF-HJB-102-CHC-STD', colorName: 'Dark Chocolate', colorHex: '#3A231B', sizeName: 'Standard (180×75 cm)', stock: 14, imageUrl: IMG.hijabChocolate },
        { sku: 'ZRF-HJB-102-CHC-MAX', colorName: 'Dark Chocolate', colorHex: '#3A231B', sizeName: 'Maxi (200×90 cm)', stock: 6, priceOverride: 1990, imageUrl: IMG.hijabChocolate },
        { sku: 'ZRF-HJB-102-TPE-STD', colorName: 'Muted Taupe', colorHex: '#A7998C', sizeName: 'Standard (180×75 cm)', stock: 11, imageUrl: IMG.catHijabs },
      ],
    },
    {
      categorySlug: 'naqaabs',
      slug: 'safa-gold-beaded-korean-nidha-naqaab',
      name: 'Safa Gold-Beaded Korean Nidha Naqaab',
      nameHi: 'सफ़ा गोल्ड-बीडेड कोरियन निदा नक़ाब',
      sku: 'ZRF-NQB-201',
      description:
        'Tailored from ultra-breathable jet-black Korean Nidha silk with hand-stitched antique champagne-gold micro beadwork along the veil edge. Engineered for effortless airflow and zero slippage.',
      descriptionHi:
        'अत्यंत आरामदायक जेट-ब्लैक कोरियन निदा सिल्क से निर्मित नक़ाब, किनारों पर हाथ से टांके गए शैम्पेन-गोल्ड मोतियों के काम के साथ।',
      fabric: 'Authentic Korean Nidha Silk',
      workDetails: 'Hand-stitched Champagne Gold Micro-Beading',
      sellingPrice: 1290,
      originalPrice: 1590,
      isBestSeller: true,
      isNewArrival: false,
      isFeatured: true,
      images: [
        { url: IMG.catNaqaabs, colorName: 'Jet Black', alt: 'Safa Korean Nidha Naqaab with gold trim' },
        { url: IMG.craftMacro, colorName: 'Jet Black', alt: 'Artisan hand-beading detail' },
        { url: IMG.hijabChocolate, colorName: 'Espresso Brown', alt: 'Espresso Brown alternative drape' },
        { url: IMG.catNaqaabs, colorName: 'Jet Black', alt: 'Tie-back strap construction' },
        { url: IMG.catHijabs, colorName: 'Jet Black', alt: 'Complementary styling pairing' },
      ],
      variants: [
        { sku: 'ZRF-NQB-201-BLK-1L', colorName: 'Jet Black', colorHex: '#151515', sizeName: 'Single Layer', stock: 24, imageUrl: IMG.catNaqaabs },
        { sku: 'ZRF-NQB-201-BLK-2L', colorName: 'Jet Black', colorHex: '#151515', sizeName: 'Two Layer', stock: 16, priceOverride: 1450, imageUrl: IMG.catNaqaabs },
        { sku: 'ZRF-NQB-201-ESP-1L', colorName: 'Espresso Brown', colorHex: '#33221C', sizeName: 'Single Layer', stock: 9, imageUrl: IMG.hijabChocolate },
      ],
    },
    {
      categorySlug: 'naqaabs',
      slug: 'amira-three-layer-breathable-georgette-naqaab',
      name: 'Amira Three-Layer Silk Georgette Naqaab',
      nameHi: 'अमीरा थ्री-लेयर सिल्क जॉर्जेट नक़ाब',
      sku: 'ZRF-NQB-202',
      description:
        'A flowing three-layer boutique naqaab crafted in featherweight Japanese silk georgette with subtle tonal gold-thread piping and soft cushioned nose-string support.',
      descriptionHi:
        'हल्के जापानी सिल्क जॉर्जेट से बना तीन-परत वाला बुटीक नक़ाब, मुलायम फिटिंग और बारीक सुनहरी पाइपिंग के साथ।',
      fabric: 'Japanese Silk Georgette',
      workDetails: 'Tonal Antique Gold Thread Edging',
      sellingPrice: 1550,
      originalPrice: 1850,
      isBestSeller: false,
      isNewArrival: true,
      isFeatured: false,
      images: [
        { url: IMG.catNaqaabs, colorName: 'Obsidian Black', alt: 'Amira Three-Layer Naqaab main view' },
        { url: IMG.hijabChocolate, colorName: 'Deep Cocoa', alt: 'Deep Cocoa silk georgette texture' },
        { url: IMG.craftMacro, colorName: 'Obsidian Black', alt: 'Hand-finished edge embroidery' },
        { url: IMG.catNaqaabs, colorName: 'Obsidian Black', alt: 'Layered fall perspective' },
        { url: IMG.catHijabs, colorName: 'Obsidian Black', alt: 'Boutique presentation fold' },
      ],
      variants: [
        { sku: 'ZRF-NQB-202-BLK-STD', colorName: 'Obsidian Black', colorHex: '#121212', sizeName: 'Standard Length', stock: 19, imageUrl: IMG.catNaqaabs },
        { sku: 'ZRF-NQB-202-BLK-LNG', colorName: 'Obsidian Black', colorHex: '#121212', sizeName: 'Long Cape', stock: 8, priceOverride: 1750, imageUrl: IMG.catNaqaabs },
        { sku: 'ZRF-NQB-202-COC-STD', colorName: 'Deep Cocoa', colorHex: '#3B2621', sizeName: 'Standard Length', stock: 5, imageUrl: IMG.hijabChocolate },
      ],
    },
    {
      categorySlug: 'dupattas',
      slug: 'shahi-zardozi-alabaster-organza-dupatta',
      name: 'Shahi Zardozi Alabaster Organza Dupatta',
      nameHi: 'शाही ज़रदोज़ी एलाबास्टर ऑर्गेंज़ा दुपट्टा',
      sku: 'ZRF-DPT-301',
      description:
        'An heirloom-grade pure silk organza dupatta adorned with dense Indian Zardozi, dabka bullion wire, and tiny ivory pearl floral motifs across all four scalloped borders.',
      descriptionHi:
        'शुद्ध सिल्क ऑर्गेंज़ा पर पारंपरिक भारतीय ज़रदोज़ी, दबका और नन्हे मोतियों के काम से सजा शाही दुपट्टा।',
      fabric: '100% Pure Silk Organza',
      workDetails: 'Hand-Embroidered Zardozi, Dabka & Ivory Pearl Motifs',
      sellingPrice: 3890,
      originalPrice: 4690,
      isBestSeller: true,
      isNewArrival: false,
      isFeatured: true,
      images: [
        { url: IMG.catDupattas, colorName: 'Alabaster Ivory', alt: 'Shahi Zardozi Organza Dupatta folded on marble' },
        { url: IMG.heroDupatta, colorName: 'Champagne Beige', alt: 'Shahi Dupatta billowing in architectural arch' },
        { url: IMG.craftMacro, colorName: 'Alabaster Ivory', alt: 'Macro view of Zardozi and pearl artisan work' },
        { url: IMG.dupattaRose, colorName: 'Rose Beige', alt: 'Rose Beige sister colourway' },
        { url: IMG.heroHijab, colorName: 'Alabaster Ivory', alt: 'Full border drape overview' },
      ],
      variants: [
        { sku: 'ZRF-DPT-301-IVR-25M', colorName: 'Alabaster Ivory', colorHex: '#F5F0E6', sizeName: '2.5 Meters', stock: 9, imageUrl: IMG.catDupattas },
        { sku: 'ZRF-DPT-301-BEG-25M', colorName: 'Champagne Beige', colorHex: '#D8C5A8', sizeName: '2.5 Meters', stock: 12, imageUrl: IMG.heroDupatta },
        { sku: 'ZRF-DPT-301-IVR-28M', colorName: 'Alabaster Ivory', colorHex: '#F5F0E6', sizeName: '2.75 Meters (Bridal)', stock: 4, priceOverride: 4390, imageUrl: IMG.catDupattas },
      ],
    },
    {
      categorySlug: 'dupattas',
      slug: 'zarina-rose-beige-nakashi-tissue-dupatta',
      name: 'Zarina Rose-Beige Nakashi Tissue Dupatta',
      nameHi: 'ज़रीना रोज़-बेज नक्काशी टिश्यू दुपट्टा',
      sku: 'ZRF-DPT-302',
      description:
        'Luminous rose-beige crushed tissue silk finished with museum-fine Nakashi border embroidery and hand-knotted silk-and-pearl tassels. Pairs effortlessly with ivory, gold, and neutral ensembles.',
      descriptionHi:
        'चमकदार रोज़-बेज टिश्यू सिल्क दुपट्टा, बारीक नक्काशी बॉर्डर और हाथ से बने मोती लटकन के साथ।',
      fabric: 'Pure Metallic Tissue Silk',
      workDetails: 'Traditional Nakashi Embroidery & Hand-Knotted Pearl Tassels',
      sellingPrice: 3290,
      originalPrice: 3990,
      isBestSeller: false,
      isNewArrival: true,
      isFeatured: true,
      images: [
        { url: IMG.dupattaRose, colorName: 'Rose Beige', alt: 'Zarina Rose-Beige Tissue Dupatta with tassels' },
        { url: IMG.craftMacro, colorName: 'Rose Beige', alt: 'Nakashi border craftsmanship close-up' },
        { url: IMG.catDupattas, colorName: 'Warm Cream', alt: 'Warm Cream edition on marble' },
        { url: IMG.heroDupatta, colorName: 'Champagne Sand', alt: 'Sunlight translucency & flow' },
        { url: IMG.catHijabs, colorName: 'Rose Beige', alt: 'Tonal palette comparison' },
      ],
      variants: [
        { sku: 'ZRF-DPT-302-RSB-25M', colorName: 'Rose Beige', colorHex: '#C9ABA0', sizeName: '2.5 Meters', stock: 13, imageUrl: IMG.dupattaRose },
        { sku: 'ZRF-DPT-302-CRM-25M', colorName: 'Warm Cream', colorHex: '#EFE6D8', sizeName: '2.5 Meters', stock: 8, imageUrl: IMG.catDupattas },
      ],
    },
  ];

  const insertedProductIds: number[] = [];

  for (const item of productSeeds) {
    const categoryId = catMap.get(item.categorySlug)!;
    const [prod] = await db
      .insert(products)
      .values({
        categoryId,
        slug: item.slug,
        name: item.name,
        nameHi: item.nameHi,
        sku: item.sku,
        description: item.description,
        descriptionHi: item.descriptionHi,
        fabric: item.fabric,
        workDetails: item.workDetails,
        sellingPrice: item.sellingPrice,
        originalPrice: item.originalPrice,
        isBestSeller: item.isBestSeller,
        isNewArrival: item.isNewArrival,
        isFeatured: item.isFeatured,
        seoTitle: `${item.name} | ZARIFLY Boutique`,
        seoDescription: item.description.slice(0, 155),
      })
      .returning();

    insertedProductIds.push(prod.id);

    await db.insert(productImages).values(
      item.images.map((img, idx) => ({
        productId: prod.id,
        url: img.url,
        altText: img.alt,
        colorName: img.colorName,
        sortOrder: idx,
      }))
    );

    await db.insert(productVariants).values(
      item.variants.map((v) => ({
        productId: prod.id,
        sku: v.sku,
        colorName: v.colorName,
        colorHex: v.colorHex,
        sizeName: v.sizeName,
        priceOverride: v.priceOverride ?? null,
        stockQuantity: v.stock,
        imageUrl: v.imageUrl,
      }))
    );
  }

  // 4. Seed Hero Banners
  await db.insert(banners).values([
    {
      heading: 'Elegance in Every Fold',
      headingHi: 'हर तह में नफ़ासत और सादगी',
      subheading:
        'Discover handcrafted Zari, Zardozi, and Nakashi hijabs woven directly in our boutique atelier.',
      subheadingHi:
        'हमारे बुटीक में हाथ से तैयार ज़री, ज़रदोज़ी और नक्काशी हिजाब का विशेष संग्रह।',
      ctaText: 'Shop Collection',
      ctaTextHi: 'कलेक्शन देखें',
      ctaUrl: '/collections/hijabs',
      desktopImageUrl: IMG.heroHijab,
      mobileImageUrl: IMG.catHijabs,
      sortOrder: 1,
      isActive: true,
    },
    {
      heading: 'Heirloom Zardozi Dupattas',
      headingHi: 'शाही ज़रदोज़ी और नक्काशी दुपट्टे',
      subheading:
        'Traditional Indian hand embroidery rendered on luminous pure silk organza and crushed tissue.',
      subheadingHi:
        'शुद्ध सिल्क ऑर्गेंज़ा और टिश्यू पर पारंपरिक भारतीय हस्तकला की बारीकी।',
      ctaText: 'Explore Dupattas',
      ctaTextHi: 'दुपट्टे देखें',
      ctaUrl: '/collections/dupattas',
      desktopImageUrl: IMG.heroDupatta,
      mobileImageUrl: IMG.catDupattas,
      sortOrder: 2,
      isActive: true,
    },
  ]);

  // 5. Seed Lookbook Reels (admin can upload Cloudinary MP4 videos via /admin)
  await db.insert(reels).values([
    {
      title: 'Zari Scalloped Hijab Drape',
      caption: 'Effortless evening drape with our Noor-e-Zari Ivory Chiffon Hijab.',
      videoUrl: '',
      thumbnailUrl: IMG.catHijabs,
      productId: insertedProductIds[0] ?? null,
      sortOrder: 1,
      isActive: true,
    },
    {
      title: 'Inside the Zardozi Atelier',
      caption: 'Up close with hand-stitched bullion dabka and ivory pearls.',
      videoUrl: '',
      thumbnailUrl: IMG.craftMacro,
      productId: insertedProductIds[4] ?? null,
      sortOrder: 2,
      isActive: true,
    },
    {
      title: 'Rose-Beige Nakashi Styling',
      caption: 'Luminous tissue silk paired with warm ivory neutrals.',
      videoUrl: '',
      thumbnailUrl: IMG.dupattaRose,
      productId: insertedProductIds[5] ?? null,
      sortOrder: 3,
      isActive: true,
    },
    {
      title: 'Breathable Korean Nidha Naqaab',
      caption: 'All-day airflow with subtle antique gold bead edging.',
      videoUrl: '',
      thumbnailUrl: IMG.catNaqaabs,
      productId: insertedProductIds[2] ?? null,
      sortOrder: 4,
      isActive: true,
    },
  ]);

  // 6. Seed SEO Blog Articles (English + Hindi)
  await db.insert(blogs).values([
    {
      slug: 'how-to-choose-the-perfect-hijab',
      title: 'How to Choose the Perfect Hijab for Every Season & Occasion',
      titleHi: 'हर मौसम और अवसर के लिए सही हिजाब कैसे चुनें',
      excerpt:
        'From breathable everyday modal-silk blends to scalloped Zari chiffon for festive evenings, learn how fabric weight and weave transform your drape.',
      excerptHi:
        'रोज़मर्रा के मोडल-सिल्क से लेकर खास अवसरों के ज़री शिफॉन तक, जानें सही कपड़े और ड्रेप का चुनाव।',
      content:
        'Choosing the right hijab begins with understanding how fabric weight, breathability, and opacity behave through the day.\n\nFor warm Indian afternoons, pure modal-silk blends offer remarkable airflow while holding crisp pleats without slipping. When transitioning into festive gatherings or wedding dinners, matte silk-chiffon bordered with hand-guided Zari work frames the face with quiet luminosity without feeling heavy.\n\nAlways inspect the edge finishing: hand-rolled hems and fine scalloped Zari borders sit softly against the collarbone and elevate minimal outfits effortlessly. Store embroidered pieces folded in breathable cotton muslin bags away from direct humidity to preserve metallic Zari brilliance for years.',
      contentHi:
        'सही हिजाब चुनने की शुरुआत कपड़े के वज़न, हवा के प्रवाह और आराम को समझने से होती है।\n\nगर्म दिनों के लिए मोडल-सिल्क ब्लेंड सबसे उपयुक्त रहता है क्योंकि यह त्वचा को आराम देता है और बिना फिसले सुंदर प्लीट्स बनाए रखता है। वहीं उत्सव और पारिवारिक समारोहों के लिए मैट सिल्क-शिफॉन पर बारीक ज़री का काम बेहद शालीन और आकर्षक दिखता है।\n\nकढ़ाई वाले हिजाब को हमेशा सूती मलमल के बैग में तह करके रखें ताकि सुनहरी ज़री की चमक वर्षों तक बनी रहे।',
      featuredImageUrl: IMG.catHijabs,
      authorName: 'Sama Shaikh',
      category: 'Hijab Guide',
      seoTitle: 'How to Choose the Perfect Hijab | ZARIFLY Journal',
      seoDescription:
        'A boutique guide by Sama Shaikh on selecting the ideal hijab fabric, drape, and Zari finish for everyday comfort and festive elegance.',
      isPublished: true,
    },
    {
      slug: 'traditional-zardozi-and-nakashi-craftsmanship',
      title: 'The Art of Traditional Zardozi & Nakashi Embroidery in Modest Couture',
      titleHi: 'मॉडेस्ट फैशन में पारंपरिक ज़रदोज़ी और नक्काशी की कला',
      excerpt:
        'Step inside the centuries-old Indian needlework traditions that define ZARIFLY’s signature borders and heirloom dupattas.',
      excerptHi:
        'भारतीय हस्तकला की सदियों पुरानी ज़रदोज़ी और नक्काशी परंपरा, जो ZARIFLY के हर दुपट्टे और हिजाब को खास बनाती है।',
      content:
        'Zardozi—literally translating to "sewing with gold"—has been revered across Indian ateliers for centuries. Using fine coiled metallic wire known as dabka, silk resham threads, and micro pearls stretched across a wooden adda frame, master karigars trace botanical scrolls stitch by stitch.\n\nAt ZARIFLY, we adapt traditional Zardozi and Nakashi specifically for modest fashion proportions. Rather than weighing down a hijab or dupatta with dense metal, our artisans balance airy silk organza and chiffon grounds with delicate border choreography so every piece drapes fluidly while honouring heritage craftsmanship.',
      contentHi:
        'ज़रदोज़ी का अर्थ है सुनहरे तारों से कढ़ाई। लकड़ी के अड्डे पर महीन दबका तार, रेशम के धागे और नन्हे मोतियों से कारीगर एक-एक टांके में फूलों और बेलों की आकृतियां उकेरते हैं।\n\nZARIFLY में हम इस पारंपरिक कला को आधुनिक मॉडेस्ट वेयर के अनुरूप हल्के सिल्क ऑर्गेंज़ा और शिफॉन पर संतुलित रूप से सजाते हैं ताकि हर पीस पहनने में हल्का और दिखने में शाही लगे।',
      featuredImageUrl: IMG.craftMacro,
      authorName: 'Sama Shaikh',
      category: 'Craftsmanship',
      seoTitle: 'Traditional Zardozi & Nakashi Craftsmanship | ZARIFLY Journal',
      seoDescription:
        'Discover how ZARIFLY artisans craft heirloom Zardozi and Nakashi embroidery on luxury hijabs and designer dupattas.',
      isPublished: true,
    },
    {
      slug: 'dupatta-styling-ideas-festive-modest-wear',
      title: 'Five Timeless Dupatta Styling Ideas for Festive & Bridal Gatherings',
      titleHi: 'त्योहारों और शादी के अवसरों के लिए दुपट्टा स्टाइलिंग के 5 तरीके',
      excerpt:
        'Elevate monochrome ivory, beige, and espresso silhouettes with tissue silk and Zardozi organza dupattas.',
      excerptHi:
        'आइवरी, बेज और चॉकलेट शेड्स के साथ टिश्यू सिल्क और ज़रदोज़ी दुपट्टे को स्टाइल करने के बेहतरीन तरीके।',
      content:
        'A finely crafted dupatta has the power to anchor an entire ensemble. For effortless grace, drape a 2.5-meter Zardozi organza dupatta loosely over one shoulder so the scalloped border catches natural light.\n\nFor traditional receptions, pleat a rose-beige Nakashi tissue dupatta neatly along the shoulder pin while letting the hand-knotted pearl tassels fall across the opposite wrist. Keep jewellery understated in champagne gold or ivory pearls so the textile artistry remains the focal point.',
      contentHi:
        'एक खूबसूरत डिज़ाइनर दुपट्टा पूरे परिधान की शोभा बढ़ा देता है। सहज और आधुनिक लुक के लिए ज़रदोज़ी ऑर्गेंज़ा दुपट्टे को एक कंधे पर खुला छोड़ें जिससे उसका बॉर्डर उभर कर दिखे।\n\nपारंपरिक समारोहों के लिए रोज़-बेज नक्काशी टिश्यू दुपट्टे को हल्की प्लीट्स में पिन करें और मोतियों वाले लटकन को आगे आने दें।',
      featuredImageUrl: IMG.dupattaRose,
      authorName: 'Sama Shaikh',
      category: 'Styling',
      seoTitle: 'Festive Dupatta Styling Ideas | ZARIFLY Journal',
      seoDescription:
        'Learn five graceful ways to style handcrafted Zardozi organza and Nakashi tissue dupattas.',
      isPublished: true,
    },
    {
      slug: 'naqaab-fabric-and-care-guide',
      title: 'The Complete Naqaab Guide: Breathable Fabrics & Gentle Care Tips',
      titleHi: 'नक़ाब गाइड: आरामदायक कपड़े और देखभाल के आसान उपाय',
      excerpt:
        'Why authentic Korean Nidha and Japanese silk georgette make all the difference for comfort, opacity, and long-lasting elegance.',
      excerptHi:
        'जानें कोरियन निदा और जापानी सिल्क जॉर्जेट नक़ाब को दिनभर आरामदायक और टिकाऊ क्यों बनाते हैं।',
      content:
        'Comfort is paramount when selecting a naqaab for daily wear or travel. Authentic Korean Nidha is prized for its cool touch, matte jet-black depth, and natural breathability even in humid climates.\n\nTo preserve hand-beaded trim and prevent fabric snags, always hand-wash your naqaab in cool water with mild liquid detergent and dry flat in shade. Steam lightly from the reverse side rather than pressing directly over delicate beadwork.',
      contentHi:
        'दैनिक उपयोग और यात्रा के लिए नक़ाब चुनते समय आराम सबसे महत्वपूर्ण है। असली कोरियन निदा अपने मुलायम स्पर्श, गहरे काले रंग और बेहतरीन एयरफ्लो के लिए जाना जाता है।\n\nमोतियों के बॉर्डर को सुरक्षित रखने के लिए नक़ाब को हमेशा ठंडे पानी में हल्के डिटर्जेंट से हाथ से धोएं और छांव में सुखाएं।',
      featuredImageUrl: IMG.catNaqaabs,
      authorName: 'Sama Shaikh',
      category: 'Care Tips',
      seoTitle: 'Complete Naqaab Fabric & Care Guide | ZARIFLY Journal',
      seoDescription:
        'Learn how to choose breathable Korean Nidha naqaabs and care for hand-beaded modest wear.',
      isPublished: true,
    },
  ]);

  // 7. Seed Promo Coupons
  await db.insert(coupons).values([
    {
      code: 'ZARIFLY10',
      description: '10% off boutique orders above ₹1,499',
      discountType: 'percentage',
      discountValue: 10,
      minOrderAmount: 1499,
      maxDiscountAmount: 750,
      isActive: true,
    },
    {
      code: 'WELCOME200',
      description: 'Flat ₹200 off on orders above ₹1,999',
      discountType: 'fixed',
      discountValue: 200,
      minOrderAmount: 1999,
      isActive: true,
    },
  ]);

  // 8. Seed Default Website Settings
  await db.insert(siteSettings).values({
    key: 'storefront',
    valueJson: {
      announcementEn: 'Discover the Art of Modest Elegance — Complimentary Shipping Across India Above ₹1,999',
      announcementHi: 'शालीन और शाही फ़ैशन की दुनिया — ₹1,999 से अधिक के ऑर्डर पर भारत भर में निःशुल्क शिपिंग',
      logoUrl: '/assets/aistudio/zarifly__2__d8ae94a1.png',
      founderPortraitUrl: '/assets/aistudio/Screenshot_2026-11-19_191431_dd1bba1b.png',
      whatsappNumber: '919619586126',
      supportEmail: 'info@zarifly.com',
      instagramUrl: 'https://www.instagram.com/shama82541/?hl=en',
      facebookUrl: 'https://www.facebook.com/profile.php?id=100091828008983',
      youtubeUrl: 'https://www.youtube.com/@ShamaShaikh-j1w',
      freeShippingThreshold: 1999,
      flatShippingFee: 120,
      taxRatePercent: 5,
      codEnabled: true,
      instagramPosts: [
        { imageUrl: IMG.heroHijab, caption: 'Ivory Zari drape from the new atelier edit', link: 'https://www.instagram.com/shama82541/?hl=en' },
        { imageUrl: IMG.catDupattas, caption: 'Hand-embroidered Zardozi organza dupatta', link: 'https://www.instagram.com/shama82541/?hl=en' },
        { imageUrl: IMG.hijabChocolate, caption: 'Rich chocolate modal-silk with antique Zari', link: 'https://www.instagram.com/shama82541/?hl=en' },
        { imageUrl: IMG.craftMacro, caption: 'Up close with dabka and pearl Nakashi work', link: 'https://www.instagram.com/shama82541/?hl=en' },
      ],
    },
  });
}
