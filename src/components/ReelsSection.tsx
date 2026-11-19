import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Instagram,
  Pause,
  Play,
  ShoppingBag,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { formatINR } from '../lib/api';
import { FOUNDER_SOCIALS } from '../lib/brandAssets';
import type { ReelItem } from '../types';

function ReelCard({ reel }: { reel: ReelItem }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsVisible(entry.isIntersecting && entry.intersectionRatio >= 0.5);
      },
      { threshold: [0.25, 0.5, 0.8] }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isVisible) {
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, [isVisible]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <motion.div
      ref={containerRef}
      whileHover={{ y: -6 }}
      transition={{ duration: 0.22 }}
      className="relative aspect-[9/16] w-[240px] sm:w-[275px] lg:w-[290px] shrink-0 snap-center rounded-[28px] bg-[#251B3B] overflow-hidden border border-white/15 shadow-[0_18px_45px_rgba(0,0,0,0.35)] group"
    >
      {reel.videoUrl ? (
        <video
          ref={videoRef}
          src={reel.videoUrl}
          poster={reel.thumbnailUrl}
          muted={isMuted}
          loop
          playsInline
          preload="metadata"
          className="w-full h-full object-cover"
        />
      ) : (
        <img
          src={reel.thumbnailUrl}
          alt={reel.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className={`w-full h-full object-cover transition-transform duration-[4500ms] ease-out ${
            isVisible ? 'scale-108' : 'scale-100'
          }`}
        />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-[#181326]/95 via-[#181326]/15 to-black/25 pointer-events-none" />

      <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between z-10">
        <span className="px-3 py-1 rounded-full bg-gradient-to-r from-[#FF4D8D] to-[#7C3AED] text-[10px] font-extrabold tracking-wider uppercase text-white shadow-sm">
          Reel
        </span>
        {reel.videoUrl ? (
          <div className="flex items-center gap-1.5">
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause reel' : 'Play reel'}
              className="w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-md border border-white/15 hover:bg-[#FF4D8D] transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.88 }}
              type="button"
              onClick={toggleMute}
              aria-label={isMuted ? 'Unmute reel' : 'Mute reel'}
              className="w-9 h-9 rounded-full bg-black/55 text-white flex items-center justify-center backdrop-blur-md border border-white/15 hover:bg-[#06B6D4] transition-colors"
            >
              {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            </motion.button>
          </div>
        ) : (
          <a
            href={FOUNDER_SOCIALS.instagram}
            target="_blank"
            rel="noreferrer"
            aria-label="Watch on Instagram"
            className="w-9 h-9 rounded-full bg-black/50 text-white flex items-center justify-center backdrop-blur-md border border-white/20 hover:bg-[#FF4D8D] transition-colors"
          >
            <Play className="w-3.5 h-3.5 ml-0.5" />
          </a>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 text-white space-y-3">
        <div>
          <h3 className="text-lg font-extrabold leading-tight text-white">{reel.title}</h3>
          {reel.caption && (
            <p className="text-xs text-[#DFD8EE]/85 line-clamp-2 mt-1">{reel.caption}</p>
          )}
        </div>
        {reel.product && (
          <Link
            to={`/products/${reel.product.slug}`}
            className="flex items-center justify-between gap-2.5 p-2.5 rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 hover:bg-white/25 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#FF4D8D] to-[#7C3AED] text-white flex items-center justify-center shrink-0">
                <ShoppingBag className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{reel.product.name}</p>
                <p className="text-[11px] font-extrabold text-[#67E8F9] tabular-nums">
                  {formatINR(reel.product.sellingPrice)}
                </p>
              </div>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[#FF85B3] shrink-0" />
          </Link>
        )}
      </div>
    </motion.div>
  );
}

export function ReelsSection({ reels }: { reels: ReelItem[] }) {
  const { t, bootstrap } = useStore();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);

  if (!reels || reels.length === 0) return null;

  const settings = bootstrap?.settings || {};

  const scrollByCard = (dir: -1 | 1) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 310, behavior: 'smooth' });
  };

  const scrollToIdx = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: idx * 310, behavior: 'smooth' });
    setActiveIdx(idx);
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.min(reels.length - 1, Math.max(0, Math.round(el.scrollLeft / 290)));
    setActiveIdx(idx);
  };

  return (
    <section className="py-14 sm:py-20 bg-gradient-to-br from-[#181326] via-[#261844] to-[#181326] text-white relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full bg-[#FF4D8D]/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-0 w-96 h-96 rounded-full bg-[#06B6D4]/20 blur-3xl"
      />

      <div className="relative max-w-[1440px] mx-auto px-4 sm:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
          <div className="space-y-1.5">
            <p className="text-xs font-extrabold tracking-[0.2em] uppercase text-[#67E8F9]">
              Zarifly Reels · Style in Motion
            </p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              {t('home.reelsTitle')}
            </h2>
            <p className="text-sm text-[#CFC5E6] max-w-xl">{t('home.reelsSub')}</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2">
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => scrollByCard(-1)}
                aria-label="Previous reels"
                className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-[#FF4D8D] hover:border-[#FF4D8D] transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                onClick={() => scrollByCard(1)}
                aria-label="Next reels"
                className="w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white hover:bg-[#06B6D4] hover:border-[#06B6D4] transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </motion.button>
            </div>

            <a
              href={settings.instagramUrl || FOUNDER_SOCIALS.instagram}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-to-r from-[#FF4D8D] via-[#EC4899] to-[#FF7A59] text-white text-xs font-extrabold tracking-wider uppercase hover:brightness-105 transition-all whitespace-nowrap shadow-lg"
            >
              <Instagram className="w-4 h-4" />
              <span>@shama82541</span>
            </a>
          </div>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-4 sm:gap-5 overflow-x-auto snap-x snap-mandatory pb-4 no-scrollbar"
        >
          {reels.map((reel) => (
            <ReelCard key={reel.id} reel={reel} />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-2">
          {reels.map((reel, idx) => (
            <button
              key={reel.id}
              type="button"
              onClick={() => scrollToIdx(idx)}
              aria-label={`View reel ${idx + 1}`}
              className={`h-2 rounded-full transition-all duration-300 ${
                idx === activeIdx
                  ? 'w-8 bg-gradient-to-r from-[#FF4D8D] to-[#06B6D4]'
                  : 'w-2 bg-white/30 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
