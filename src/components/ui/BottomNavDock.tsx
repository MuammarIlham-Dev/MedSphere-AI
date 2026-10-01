import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface DockItem {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}

export interface BottomNavDockProps {
  items: DockItem[];
  activeId: string;
  className?: string;
}

export function BottomNavDock({ items, activeId, className }: BottomNavDockProps) {
  return (
    <div className={cn('fixed bottom-0 left-0 right-0 z-50 bg-surface-card border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] md:hidden pb-safe', className)}>
      <div className="flex items-center justify-around px-4 py-2">
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              className={cn(
                'flex flex-col items-center justify-center gap-1 transition-all duration-300 w-16'
              )}
            >
              <div className={cn(
                "h-8 w-12 rounded-full flex items-center justify-center transition-colors duration-300",
                isActive ? "bg-brand-rose text-brand-700" : "text-gray-400 hover:text-gray-600"
              )}>
                {item.icon}
              </div>
              <span className={cn(
                "text-[9px] font-bold tracking-wide",
                isActive ? "text-brand-950" : "text-gray-400"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
