import {
  Baby, Book, Briefcase, Building2, Car, Coffee, Coins, Dumbbell, Film, Gift, Globe, GraduationCap, HeartPulse, Hotel,
  House, Landmark, Laptop, Mountain, Music, PawPrint, PiggyBank, Plane, Receipt, Shield, Shirt, ShoppingBag, Smartphone,
  Sparkles, Tag, Target, Ticket, TrainFront, TrendingUp, Utensils, Wallet, Wifi, Wrench, Zap, type LucideIcon,
} from 'lucide-react';
import type { IconName } from '@/types';
import { cn } from '@/utils/cn';

export const ICONS: Record<IconName, LucideIcon> = {
  home: House, utensils: Utensils, car: Car, plane: Plane, 'shopping-bag': ShoppingBag, zap: Zap, 'heart-pulse': HeartPulse,
  film: Film, 'graduation-cap': GraduationCap, gift: Gift, shield: Shield, wifi: Wifi, coffee: Coffee, dumbbell: Dumbbell,
  'paw-print': PawPrint, baby: Baby, briefcase: Briefcase, laptop: Laptop, 'trending-up': TrendingUp, building: Building2,
  landmark: Landmark, coins: Coins, 'piggy-bank': PiggyBank, wallet: Wallet, receipt: Receipt, ticket: Ticket, hotel: Hotel,
  train: TrainFront, globe: Globe, mountain: Mountain, sparkles: Sparkles, target: Target, tag: Tag, smartphone: Smartphone,
  shirt: Shirt, wrench: Wrench, book: Book, music: Music,
};
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

/** A category glyph sitting in a tinted square — the colour carries meaning, the icon aids scanning. */
export function CategoryGlyph({
  icon, color, size = 32, className,
}: { icon?: string; color?: string; size?: number; className?: string }) {
  const I = ICONS[(icon as IconName) ?? 'tag'] ?? Tag;
  const c = color ?? '#8ba4a7';
  return (
    <span
      aria-hidden
      className={cn('inline-grid shrink-0 place-items-center rounded-[9px]', className)}
      style={{
        width: size, height: size,
        background: `color-mix(in oklab, ${c} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${c} 22%, transparent)`,
        color: c,
      }}
    >
      <I size={Math.round(size * 0.47)} strokeWidth={1.75} />
    </span>
  );
}
