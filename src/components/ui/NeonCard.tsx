import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface NeonCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Animation speed override, e.g. "4.2s".
   * Defaults to the CSS variable default (3.5 s).
   */
  speed?: string;
  /**
   * Inner content wrapper className.
   * The inner div always gets `m-[1px] rounded-[inherit]` — add extra
   * classes (padding, background, etc.) via this prop.
   * @default 'bg-surface dark:bg-surface-dark p-5'
   */
  innerClassName?: string;
  children?: React.ReactNode;
}

/**
 * NeonCard
 * --------
 * Drop-in wrapper that adds a GPU-composited conic-gradient rotating
 * border (cyan → blue → violet → fuchsia) to any card-like element.
 *
 * Usage:
 * ```tsx
 * <NeonCard className="rounded-2xl max-w-sm">
 *   <h2>Hello</h2>
 *   <p>World</p>
 * </NeonCard>
 *
 * // Custom speed
 * <NeonCard speed="5s" className="rounded-xl" innerClassName="bg-slate-900 p-8">
 *   …
 * </NeonCard>
 * ```
 *
 * Rules:
 * - The **outer** element carries `.neon-card` and `border-radius`.
 * - The **inner** wrapper always gets `m-[1px] rounded-[inherit]` so the
 *   1 px animated border ring is revealed correctly.
 * - Override `--neon-speed` per-instance via the `speed` prop or inline
 *   style: `style={{ '--neon-speed': '6s' } as React.CSSProperties}`.
 */
const NeonCard = forwardRef<HTMLDivElement, NeonCardProps>(
  (
    {
      speed,
      className,
      innerClassName,
      style,
      children,
      ...rest
    },
    ref,
  ) => {
    const outerStyle: React.CSSProperties = {
      ...(speed ? ({ '--neon-speed': speed } as React.CSSProperties) : {}),
      ...style,
    };

    return (
      <div
        ref={ref}
        className={cn('neon-card', className)}
        style={outerStyle}
        {...rest}
      >
        {/* Inner wrapper — MUST stay m-[1px] rounded-[inherit] to reveal the 1px border ring */}
        <div
          className={cn(
            'relative m-[1px] rounded-[inherit]',
            'bg-surface dark:bg-surface-dark',
            innerClassName,
          )}
        >
          {children}
        </div>
      </div>
    );
  },
);

NeonCard.displayName = 'NeonCard';

export { NeonCard };
export type { NeonCardProps };
