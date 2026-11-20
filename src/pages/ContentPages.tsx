import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ChevronDown,
  Facebook,
  Instagram,
  Mail,
  MessageCircle,
  Youtube,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { submitContactMessage } from '../lib/firestoreStore';
import { FOUNDER_SOCIALS, OFFICIAL_FOUNDER_PORTRAIT } from '../lib/brandAssets';
import { CATALOG_IMAGES } from '../lib/defaultCatalog';
import { SEO } from '../components/SEO';

export function AboutPage() {
  const { lang } = useStore();
  return (
    <>
      <SEO
        title="About Us | ZARIFLY — Boutique Islamic Fashion & Handcrafted Modest Wear"
        description="Learn about ZARIFLY, a direct-to-consumer boutique Islamic fashion manufacturing brand specializing in Zari, Zardozi, and Nakashi hijabs, naqaabs, and dupattas."
        canonicalPath="/about-us"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-16 space-y-12">
        <header className="space-y-4 text-center max-w-3xl mx-auto">
          <p className="text-xs font-extrabold tracking-[0.22em] uppercase text-[#FF4D8D]">
            House of ZARIFLY
          </p>
          <h1 className="font-serif-display text-4xl sm:text-6xl font-extrabold text-[#181326]">
            {lang === 'hi'
              ? 'पारंपरिक भारतीय हस्तकला और आधुनिक शालीनता'
              : 'Traditional Indian Craftsmanship Meets Contemporary Modest Elegance'}
          </h1>
          <p className="text-sm sm:text-base text-[#5E5474] leading-relaxed">
            ZARIFLY is a boutique Islamic fashion manufacturing house founded by Sama Shaikh,
            crafting heirloom-grade Hijabs, Naqaabs, and Designer Dupattas directly from our studio
            to patrons across India.
          </p>
        </header>

        <div className="aspect-[16/9] rounded-[34px] bg-[#F3EEFF] border-4 border-white shadow-[0_20px_50px_rgba(124,58,237,0.12)] overflow-hidden">
          <img
            src={CATALOG_IMAGES.craftMacro}
            alt="ZARIFLY Zardozi and Nakashi embroidery artistry"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: 'Direct Boutique Manufacturing',
              text: 'Every ZARIFLY hijab, naqaab, and dupatta is conceived, embroidered, and finished under our direct supervision—ensuring uncompromised fabric quality and direct B2C value.',
              bg: 'bg-[#FFF0F6]/85 border-[#FF4D8D]/25',
            },
            {
              title: 'Zari, Zardozi & Nakashi',
              text: 'Our karigars honour centuries-old Indian needlework while calibrating thread weight so every piece feels airy, fluid, and effortless to drape.',
              bg: 'bg-[#F3EEFF]/85 border-[#7C3AED]/25',
            },
            {
              title: 'Three Dedicated Silhouettes',
              text: 'Rather than diluting our focus, ZARIFLY dedicates its entire craft exclusively to Hijabs, Naqaabs, and Dupattas—perfecting every fold, seam, and pearl tassel.',
              bg: 'bg-[#ECFEFF]/85 border-[#06B6D4]/25',
            },
          ].map((item) => (
            <div
              key={item.title}
              className={`${item.bg} rounded-[26px] border p-7 space-y-2.5`}
            >
              <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">
                {item.title}
              </h2>
              <p className="text-sm text-[#5E5474] leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>

        <div className="text-center pt-4">
          <Link
            to="/shop"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-110 transition-all shadow-lg"
          >
            Explore Our Collection
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </>
  );
}

export function FounderPage() {
  const { bootstrap, t } = useStore();
  const settings = bootstrap?.settings || {};
  const portraitSrc = settings.founderPortraitUrl?.trim() || OFFICIAL_FOUNDER_PORTRAIT;

  return (
    <>
      <SEO
        title="Meet the Founder – Sama Shaikh | ZARIFLY Boutique"
        description="Meet Sama Shaikh, Founder and official face of ZARIFLY, bringing traditional Indian Zari, Zardozi, and Nakashi craftsmanship to modern modest fashion."
        canonicalPath="/founder"
        image={portraitSrc}
      />

      <div className="bg-gradient-to-br from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] py-14 sm:py-20">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
          <div className="bg-white/92 backdrop-blur-md rounded-[36px] border border-[#E9DDFC] p-6 sm:p-12 lg:p-16 shadow-[0_24px_65px_rgba(124,58,237,0.1)]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5 relative flex justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                  aria-hidden="true"
                  className="pointer-events-none absolute -inset-3 rounded-[40px] border-2 border-dashed border-[#FF4D8D]/45"
                />
                <div className="relative w-full max-w-[440px] aspect-square rounded-[32px] overflow-hidden border-[5px] border-white shadow-xl bg-[#F3EEFF]">
                  <img
                    src={portraitSrc}
                    alt="Sama Shaikh — Founder & Face of ZARIFLY"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover object-top"
                  />
                </div>
              </div>

              <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
                <div className="flex items-center gap-3">
                  <span className="h-[3px] w-10 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED]" />
                  <p className="text-xs font-extrabold tracking-[0.22em] uppercase text-[#7C3AED]">
                    Founder &amp; Face of ZARIFLY
                  </p>
                </div>

                <div>
                  <h1 className="font-serif-display text-4xl sm:text-6xl font-extrabold text-[#181326]">
                    Meet the Face Behind Zarifly
                  </h1>
                  <p className="font-serif-display text-3xl font-bold bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] bg-clip-text text-transparent mt-1">
                    Sama Shaikh
                  </p>
                </div>

                <p className="text-base sm:text-lg text-[#3D3452] leading-relaxed">
                  Discover the story behind Zarifly, where modest elegance meets the beauty of
                  traditional craftsmanship.
                </p>

                <p className="text-sm sm:text-base text-[#5E5474] leading-relaxed">
                  {t('home.founderIntro')}
                </p>

                <p className="text-sm text-[#64597A] leading-relaxed">
                  As a modest fashion voice and creative director, Sama personally curates every
                  colour palette, fabric weight, and hand-embroidered border—from luminous Zari
                  hijabs for everyday grace to heirloom Zardozi organza dupattas crafted for
                  life&apos;s most cherished celebrations.
                </p>

                <div className="pt-2 flex flex-wrap gap-3">
                  <a
                    href={settings.instagramUrl || FOUNDER_SOCIALS.instagram}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#FF7A59] text-white text-xs font-extrabold shadow-md hover:brightness-105 transition-all"
                  >
                    <Instagram className="w-4 h-4" />
                    <span>Follow on Instagram</span>
                  </a>
                  <a
                    href={settings.youtubeUrl || FOUNDER_SOCIALS.youtube}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#181326] text-white text-xs font-extrabold shadow-md hover:bg-[#EF4444] transition-colors"
                  >
                    <Youtube className="w-4 h-4 text-[#FF9EC2]" />
                    <span>Watch on YouTube</span>
                  </a>
                  <a
                    href={settings.facebookUrl || FOUNDER_SOCIALS.facebook}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full bg-[#ECFEFF] text-[#0E7490] border border-[#06B6D4]/45 text-xs font-extrabold hover:bg-[#06B6D4] hover:text-white transition-colors"
                  >
                    <Facebook className="w-4 h-4" />
                    <span>Connect with Sama</span>
                  </a>
                </div>

                <div className="pt-3">
                  <Link
                    to="/shop"
                    className="inline-flex items-center gap-2.5 px-8 py-4 rounded-full bg-[#181326] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:bg-gradient-to-r hover:from-[#FF4D8D] hover:to-[#7C3AED] transition-all shadow-lg"
                  >
                    <span>{t('home.founderCta')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ContactPage() {
  const { notify, bootstrap } = useStore();
  const settings = bootstrap?.settings || {};
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: 'Product Inquiry',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await submitContactMessage(form);
      notify('Your inquiry has been received. Our concierge will respond shortly.', 'success');
      setForm({ name: '', email: '', phone: '', subject: 'Product Inquiry', message: '' });
    } catch (err: any) {
      notify(err?.message || 'Unable to send message.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    'px-4 py-3 rounded-2xl text-sm bg-[#FAFAFF] border border-[#E2D9F3] outline-none focus:border-[#7C3AED] focus:bg-white transition-colors';

  return (
    <>
      <SEO
        title="Contact Us | ZARIFLY Boutique Concierge"
        description="Reach ZARIFLY customer care via WhatsApp (+91 9619586126), email (info@zarifly.com), or our direct boutique inquiry form."
        canonicalPath="/contact-us"
      />
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5 space-y-6">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#FF4D8D]">
            Style Support
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326]">
            Get in Touch
          </h1>
          <p className="text-sm text-[#5E5474] leading-relaxed">
            Whether you need styling advice on Zari &amp; Zardozi pieces, sizing assistance, or help
            with an existing order, our team is happy to assist you.
          </p>

          <div className="space-y-4 pt-2 text-sm">
            <a
              href={`https://wa.me/${(settings.whatsappNumber || '919619586126').replace(/\D/g, '')}?text=${encodeURIComponent(
                'Hello Zarifly, I would like assistance from your boutique team.'
              )}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-[#EDE8F7] hover:border-[#10B981] shadow-xs transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#10B981]">
                <MessageCircle className="w-5 h-5" />
              </span>
              <div>
                <p className="font-bold text-[#181326]">WhatsApp Support</p>
                <p className="text-xs text-[#64597A]">+91 9619586126</p>
              </div>
            </a>

            <a
              href={`mailto:${settings.supportEmail || 'info@zarifly.com'}`}
              className="flex items-center gap-3.5 p-4 rounded-2xl bg-white border border-[#EDE8F7] hover:border-[#7C3AED] shadow-xs transition-colors"
            >
              <span className="w-11 h-11 rounded-full bg-[#F3EEFF] flex items-center justify-center text-[#7C3AED]">
                <Mail className="w-5 h-5" />
              </span>
              <div>
                <p className="font-bold text-[#181326]">Official Email</p>
                <p className="text-xs text-[#64597A]">
                  {settings.supportEmail || 'info@zarifly.com'}
                </p>
              </div>
            </a>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 bg-white rounded-[32px] border border-[#EDE8F7] p-6 sm:p-10 space-y-4 shadow-[0_14px_40px_rgba(124,58,237,0.06)]"
        >
          <h2 className="font-serif-display text-3xl font-extrabold text-[#181326]">
            Send a Message
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Full Name *"
              className={inputClass}
            />
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email Address *"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="Mobile Number"
              className={inputClass}
            />
            <input
              type="text"
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Subject"
              className={inputClass}
            />
          </div>
          <textarea
            required
            rows={5}
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="How may we assist you? *"
            className={`w-full ${inputClass}`}
          />
          <button
            type="submit"
            disabled={submitting}
            className="px-8 py-4 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-white text-xs font-extrabold uppercase tracking-[0.14em] hover:brightness-110 transition-all shadow-md"
          >
            {submitting ? 'Sending...' : 'Submit Inquiry'}
          </button>
        </form>
      </div>
    </>
  );
}

const FAQS = [
  {
    q: 'Are ZARIFLY hijabs, naqaabs, and dupattas manufactured in-house?',
    a: 'Yes. ZARIFLY is a boutique Islamic fashion manufacturing brand. Our karigars handcraft Zari, Zardozi, and Nakashi pieces directly under our quality supervision.',
  },
  {
    q: 'How long does shipping take across India?',
    a: 'Orders are dispatched within 24–48 hours. Delivery takes 2–3 business days within Maharashtra, 3–5 business days to major metros, and 5–7 business days to other serviceable Indian PIN codes.',
  },
  {
    q: 'How should I care for Zari and Zardozi embroidered hijabs and dupattas?',
    a: 'We recommend gentle dry cleaning for heavy Zardozi organza dupattas, and cool-water hand washing with mild liquid detergent for Zari hijabs and Korean Nidha naqaabs. Always dry flat in shade and steam lightly from the reverse side.',
  },
  {
    q: 'Do you accept Cash on Delivery (COD) and online UPI/Card payments?',
    a: 'Yes, we support secure online payments via PayU India (UPI, Debit/Credit Cards, NetBanking) as well as Cash on Delivery across serviceable PIN codes.',
  },
  {
    q: 'What is your return and exchange policy?',
    a: 'Unused items in original boutique packaging with tags intact are eligible for return or exchange within 7 days of delivery. Contact our WhatsApp concierge (+91 9619586126) with your order number.',
  },
];

export function FaqPage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  return (
    <>
      <SEO
        title="Frequently Asked Questions (FAQ) | ZARIFLY Boutique"
        description="Answers to common questions about ZARIFLY handcrafted hijabs, naqaabs, dupattas, Indian shipping, care instructions, and returns."
        canonicalPath="/faq"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: FAQS.map((f) => ({
            '@type': 'Question',
            name: f.q,
            acceptedAnswer: { '@type': 'Answer', text: f.a },
          })),
        }}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#7C3AED]">Client Care</p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326]">
            Frequently Asked Questions
          </h1>
        </div>
        <div className="bg-white rounded-[30px] border border-[#EDE8F7] divide-y divide-[#EDE8F7] shadow-xs overflow-hidden">
          {FAQS.map((item, idx) => {
            const open = openIdx === idx;
            return (
              <div key={item.q}>
                <button
                  type="button"
                  onClick={() => setOpenIdx(open ? null : idx)}
                  className="w-full text-left px-6 py-5 flex items-center justify-between gap-4 hover:bg-[#FAFAFF] transition-colors"
                >
                  <span className="font-serif-display text-xl font-bold text-[#181326]">
                    {item.q}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-[#FF4D8D] shrink-0 transition-transform ${
                      open ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {open && (
                  <div className="px-6 pb-5 text-sm text-[#5E5474] leading-relaxed">{item.a}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

const POLICIES: Record<
  string,
  { title: string; path: string; sections: Array<{ h: string; p: string }> }
> = {
  privacy: {
    title: 'Privacy Policy',
    path: '/privacy-policy',
    sections: [
      {
        h: 'Information We Collect',
        p: 'When you browse or order from ZARIFLY, we collect only the information necessary to fulfill your order and personalize your boutique experience—such as your name, email address, phone number, and delivery address. If you explicitly click "Detect My Location" at checkout, coordinates are used solely to populate your address and are never shared with third-party advertisers.',
      },
      {
        h: 'Payment Security',
        p: 'Online payments are processed directly through official PayU India encrypted gateways. ZARIFLY never stores your card numbers, CVV, or UPI PINs on our servers.',
      },
      {
        h: 'Your Rights & Contact',
        p: 'You may request access to, correction of, or deletion of your account data at any time by writing to info@zarifly.com.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    path: '/terms-and-conditions',
    sections: [
      {
        h: 'Handcrafted Textile Variations',
        p: 'Because ZARIFLY pieces feature authentic hand-worked Zari, Zardozi, and Nakashi embroidery, subtle variations in thread tension or sheen are a hallmark of genuine craftsmanship.',
      },
      {
        h: 'Pricing & Orders',
        p: 'All prices are listed in Indian Rupees (INR) inclusive of applicable GST. Inventory is reserved atomically at checkout.',
      },
      {
        h: 'Intellectual Property',
        p: 'The ZARIFLY name, brand logo, photography, and embroidery patterns are the exclusive property of ZARIFLY.',
      },
    ],
  },
  shipping: {
    title: 'Shipping Policy',
    path: '/shipping-policy',
    sections: [
      {
        h: 'Dispatch & Delivery Timelines',
        p: 'Ready-to-ship Hijabs, Naqaabs, and Dupattas are quality-inspected and dispatched within 24–48 business hours. Standard delivery across India takes 2–7 business days depending on your PIN code.',
      },
      {
        h: 'Complimentary Shipping',
        p: 'We offer complimentary insured delivery on orders above ₹1,999. Orders below ₹1,999 incur a flat shipping fee of ₹120.',
      },
      {
        h: 'Order Tracking',
        p: 'Once dispatched, courier details and tracking numbers are available immediately on our Track Order page and in your My Account dashboard.',
      },
    ],
  },
  returns: {
    title: 'Return & Refund Policy',
    path: '/return-refund-policy',
    sections: [
      {
        h: '7-Day Boutique Return Window',
        p: 'We accept returns or size/colour exchanges within 7 calendar days of delivery provided the piece is unworn, unwashed, and returned in its original ZARIFLY packaging with all tags intact.',
      },
      {
        h: 'Refund Processing',
        p: 'Once the returned item passes quality inspection, prepaid PayU India orders are refunded to the original payment source within 5–7 business days. COD refunds are transferred via verified UPI/bank transfer.',
      },
    ],
  },
  cancellation: {
    title: 'Cancellation Policy',
    path: '/cancellation-policy',
    sections: [
      {
        h: 'Before Dispatch',
        p: 'Orders may be cancelled for a full refund prior to courier dispatch by messaging +91 9619586126 on WhatsApp or emailing info@zarifly.com with your order number.',
      },
      {
        h: 'After Dispatch',
        p: 'Once a parcel has been handed to our courier partner, it cannot be cancelled in transit; however, you may request a return within 7 days of receipt under our Return & Refund Policy.',
      },
    ],
  },
};

export function PolicyPage({ type }: { type: keyof typeof POLICIES }) {
  const doc = POLICIES[type];
  return (
    <>
      <SEO
        title={`${doc.title} | ZARIFLY Boutique`}
        description={`Official ZARIFLY ${doc.title} for handcrafted modest fashion orders across India.`}
        canonicalPath={doc.path}
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <header className="pb-6 border-b border-[#EDE8F7]">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#7C3AED]">
            ZARIFLY Policies
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326] mt-1">
            {doc.title}
          </h1>
        </header>
        <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-10 space-y-6 shadow-xs">
          {doc.sections.map((s) => (
            <section key={s.h} className="space-y-2">
              <h2 className="font-serif-display text-2xl font-extrabold text-[#181326]">{s.h}</h2>
              <p className="text-sm text-[#4D4463] leading-relaxed">{s.p}</p>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}
