import { useStore } from '../context/StoreContext';
import { OFFICIAL_ZARIFLY_LOGO } from '../lib/brandAssets';

interface ZariflyLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  light?: boolean;
}

/**
 * Renders the authentic supplied ZARIFLY™ gold logo with bird emblem.
 * The official PNG is 500x500 with generous top/bottom transparent padding around
 * the horizontal wordmark; we frame it cleanly with zero aspect distortion so the
 * gold lettering and bird symbol appear large, sharp, and unmistakable everywhere.
 */
export function ZariflyLogo({ className = '', size = 'md', light = false }: ZariflyLogoProps) {
  const { bootstrap } = useStore();
  const customLogoUrl = bootstrap?.settings?.logoUrl?.trim();
  const isCustomExternal = Boolean(customLogoUrl && customLogoUrl !== OFFICIAL_ZARIFLY_LOGO);

  if (isCustomExternal && customLogoUrl) {
    const customHeight =
      size === 'sm' ? 'h-8' : size === 'lg' ? 'h-12' : size === 'xl' ? 'h-14' : 'h-10';
    return (
      <img
        src={customLogoUrl}
        alt="ZARIFLY"
        referrerPolicy="no-referrer"
        className={`${customHeight} w-auto object-contain select-none ${className}`}
      />
    );
  }

  const frameMap = {
    sm: { box: 'w-[104px] h-[38px]', img: 'w-[134px] h-[134px]' },
    md: { box: 'w-[132px] h-[46px]', img: 'w-[170px] h-[170px]' },
    lg: { box: 'w-[164px] h-[58px]', img: 'w-[212px] h-[212px]' },
    xl: { box: 'w-[196px] h-[68px]', img: 'w-[252px] h-[252px]' },
  }[size];

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden select-none shrink-0 ${frameMap.box} ${className}`}
    >
      <img
        src={OFFICIAL_ZARIFLY_LOGO}
        alt="ZariFly — Luxury Islamic Fashion"
        referrerPolicy="no-referrer"
        className={`${frameMap.img} max-w-none object-contain -translate-y-[1.5%] transition-transform duration-200 ${
          light
            ? 'brightness-115 contrast-105 drop-shadow-[0_2px_10px_rgba(197,155,86,0.4)]'
            : 'contrast-105 drop-shadow-[0_1px_3px_rgba(37,32,42,0.12)]'
        }`}
      />
    </span>
  );
}
