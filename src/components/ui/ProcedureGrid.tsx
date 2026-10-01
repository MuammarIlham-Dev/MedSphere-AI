import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

export interface Procedure {
  id: string;
  title: string;
  icon: ReactNode;
  onClick?: () => void;
}

export interface ProcedureGridProps {
  procedures: Procedure[];
  className?: string;
}

export function ProcedureGrid({ procedures, className }: ProcedureGridProps) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-4 gap-4', className)}>
      {procedures.map((proc) => (
        <button
          key={proc.id}
          onClick={proc.onClick}
          className="group relative flex flex-col items-center justify-center gap-3 p-6 glass rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-soft active:translate-y-0"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-2xl text-brand-500 transition-colors duration-300 group-hover:bg-brand-500 group-hover:text-white group-hover:shadow-glow">
            {proc.icon}
          </div>
          <span className="text-sm font-semibold text-brand-900">{proc.title}</span>
        </button>
      ))}
    </div>
  );
}
