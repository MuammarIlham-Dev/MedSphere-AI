import { cn } from '@/lib/utils';
import type { ImgHTMLAttributes } from 'react';

export interface AvatarProps extends ImgHTMLAttributes<HTMLImageElement> {
  alt: string;
}

export function Avatar({ className, alt, ...props }: AvatarProps) {
  return (
    <img
      className={cn('inline-block h-8 w-8 rounded-full border-2 border-surface-canvas bg-white object-cover', className)}
      alt={alt}
      {...props}
    />
  );
}

export interface AvatarStackProps {
  avatars: { src: string; alt: string }[];
  limit?: number;
  className?: string;
}

export function AvatarStack({ avatars, limit = 3, className }: AvatarStackProps) {
  const visibleAvatars = avatars.slice(0, limit);
  const remaining = avatars.length - limit;

  return (
    <div className={cn('flex -space-x-2 overflow-hidden', className)}>
      {visibleAvatars.map((avatar, i) => (
        <Avatar key={i} src={avatar.src} alt={avatar.alt} />
      ))}
      {remaining > 0 && (
        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-canvas bg-brand-50 text-xs font-semibold text-brand-900">
          +{remaining}
        </div>
      )}
    </div>
  );
}
