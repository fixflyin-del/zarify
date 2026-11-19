import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Share2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { fetchPublishedBlogs } from '../lib/firestoreStore';
import { DEFAULT_BLOGS } from '../lib/defaultCatalog';
import { SEO } from '../components/SEO';
import type { BlogPost } from '../types';

export function BlogListPage() {
  const { lang } = useStore();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPublishedBlogs()
      .then((blogs) => setPosts(blogs.length ? blogs : DEFAULT_BLOGS))
      .catch(() => setPosts(DEFAULT_BLOGS))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <SEO
        title="ZARIFLY Journal — Hijab Styling, Zardozi Craft & Modest Fashion Guides"
        description="Read editorial articles by Sama Shaikh on hijab fabrics, Zari and Zardozi embroidery, festive dupatta styling, and naqaab care."
        canonicalPath="/blog"
      />

      <section className="bg-gradient-to-r from-[#FFF0F6] via-[#F3EEFF] to-[#ECFEFF] border-b border-[#E9DDFC]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12 sm:py-16 space-y-2">
          <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#7C3AED]">
            Style Journal
          </p>
          <h1 className="font-serif-display text-4xl sm:text-6xl font-extrabold text-[#181326]">
            {lang === 'hi' ? 'ZARIFLY फ़ैशन जर्नल' : 'The ZARIFLY Journal'}
          </h1>
          <p className="text-sm sm:text-base text-[#5E5474] max-w-2xl">
            Notes on Indian Zardozi heritage, effortless hijab draping, and caring for modern modest textiles.
          </p>
        </div>
      </section>

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-80 rounded-[28px] bg-white animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {posts.map((post) => (
              <article
                key={post.id}
                className="bg-white rounded-[28px] border border-[#EDE8F7] flex flex-col overflow-hidden group shadow-[0_8px_28px_rgba(124,58,237,0.06)] hover:shadow-[0_16px_40px_rgba(124,58,237,0.12)] transition-all"
              >
                <Link
                  to={`/blog/${post.slug}`}
                  className="aspect-[16/10] bg-[#FFF0F6] overflow-hidden"
                >
                  <img
                    src={post.featuredImageUrl}
                    alt={post.title}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </Link>
                <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2.5">
                    <p className="text-xs font-extrabold text-[#FF4D8D]">
                      {post.category} · {post.authorName} ·{' '}
                      {new Date(post.publishedAt).toLocaleDateString('en-IN')}
                    </p>
                    <Link
                      to={`/blog/${post.slug}`}
                      className="block font-serif-display text-2xl sm:text-3xl font-extrabold text-[#181326] hover:text-[#7C3AED] transition-colors"
                    >
                      {lang === 'hi' && post.titleHi ? post.titleHi : post.title}
                    </Link>
                    <p className="text-sm text-[#64597A] leading-relaxed">
                      {lang === 'hi' && post.excerptHi ? post.excerptHi : post.excerpt}
                    </p>
                  </div>
                  <Link
                    to={`/blog/${post.slug}`}
                    className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-[#7C3AED] hover:text-[#FF4D8D]"
                  >
                    <span>Read Article</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { lang, notify } = useStore();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetchPublishedBlogs()
      .then((blogs) => {
        const list = blogs.length ? blogs : DEFAULT_BLOGS;
        const found = list.find((b) => b.slug === slug) || null;
        setPost(found);
        setRelated(found ? list.filter((b) => b.id !== found.id).slice(0, 3) : []);
      })
      .catch(() => {
        const fallback = DEFAULT_BLOGS.find((b) => b.slug === slug) || null;
        setPost(fallback);
        setRelated(fallback ? DEFAULT_BLOGS.filter((b) => b.id !== fallback.id).slice(0, 3) : []);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-14 space-y-6">
        <div className="h-10 w-3/4 rounded-full bg-[#F3EEFF] animate-pulse" />
        <div className="aspect-[16/9] rounded-[28px] bg-white animate-pulse" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="font-serif-display text-3xl font-extrabold text-[#181326]">
          Article Not Found
        </h1>
        <Link to="/blog" className="text-xs font-bold text-[#7C3AED] underline">
          Return to Journal
        </Link>
      </div>
    );
  }

  const title = lang === 'hi' && post.titleHi ? post.titleHi : post.title;
  const content = lang === 'hi' && post.contentHi ? post.contentHi : post.content;

  const shareUrl = window.location.href;
  const handleCopyShare = () => {
    navigator.clipboard?.writeText(shareUrl);
    notify('Article link copied to clipboard.', 'success');
  };

  return (
    <>
      <SEO
        title={post.seoTitle || `${post.title} | ZARIFLY Journal`}
        description={post.seoDescription || post.excerpt}
        canonicalPath={`/blog/${post.slug}`}
        image={post.featuredImageUrl}
        type="article"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: post.title,
          description: post.excerpt,
          author: { '@type': 'Person', name: post.authorName },
          publisher: { '@type': 'Organization', name: 'ZARIFLY' },
          datePublished: post.publishedAt,
        }}
      />

      <article className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-16 space-y-8">
        <nav className="text-xs text-[#64597A] flex items-center gap-2">
          <Link to="/" className="hover:text-[#FF4D8D]">
            Home
          </Link>
          <span>/</span>
          <Link to="/blog" className="hover:text-[#FF4D8D]">
            Journal
          </Link>
          <span>/</span>
          <span className="text-[#181326] font-semibold truncate">{title}</span>
        </nav>

        <header className="space-y-4">
          <p className="text-xs font-extrabold text-[#FF4D8D] tracking-wide">
            {post.category} · By {post.authorName} ·{' '}
            {new Date(post.publishedAt).toLocaleDateString('en-IN')}
          </p>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-extrabold text-[#181326] leading-tight">
            {title}
          </h1>
        </header>

        <div className="aspect-[16/9] rounded-[30px] bg-[#FFF0F6] border border-[#EDE8F7] overflow-hidden shadow-md">
          <img
            src={post.featuredImageUrl}
            alt={post.title}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>

        <div className="bg-white rounded-[30px] border border-[#EDE8F7] p-6 sm:p-10 space-y-5 text-base leading-relaxed text-[#3D3452] shadow-xs">
          {content.split('\n\n').map((para, idx) => (
            <p key={idx}>{para}</p>
          ))}

          <div className="pt-6 mt-6 border-t border-[#EDE8F7] flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs font-semibold text-[#64597A]">Share this article</span>
            <div className="flex items-center gap-2.5 text-xs">
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${title} — ${shareUrl}`)}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-full border border-[#E2D9F3] font-bold hover:border-[#10B981] hover:text-[#10B981]"
              >
                WhatsApp
              </a>
              <button
                type="button"
                onClick={handleCopyShare}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-[#E2D9F3] font-bold hover:border-[#7C3AED] hover:text-[#7C3AED]"
              >
                <Share2 className="w-3.5 h-3.5" />
                Copy Link
              </button>
            </div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="pt-10 border-t border-[#EDE8F7] space-y-6">
            <h2 className="font-serif-display text-3xl font-extrabold text-[#181326]">
              Related Articles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {related.map((r) => (
                <Link
                  key={r.id}
                  to={`/blog/${r.slug}`}
                  className="bg-white rounded-[24px] border border-[#EDE8F7] p-4 space-y-2.5 hover:border-[#7C3AED] transition-colors shadow-xs"
                >
                  <img
                    src={r.featuredImageUrl}
                    alt={r.title}
                    referrerPolicy="no-referrer"
                    className="aspect-[4/3] w-full rounded-[16px] object-cover bg-[#FFF0F6]"
                  />
                  <p className="text-[11px] font-extrabold text-[#FF4D8D]">{r.category}</p>
                  <h3 className="font-serif-display text-lg font-bold text-[#181326] leading-snug">
                    {lang === 'hi' && r.titleHi ? r.titleHi : r.title}
                  </h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </>
  );
}
