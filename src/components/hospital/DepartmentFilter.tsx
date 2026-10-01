import { useRef } from 'react';
import { cn } from '@/lib/utils';
import { type DepartmentKey, getDepartmentCounts } from '@/data/popularDiagnosticRajshahi';
import { User, Heart, Sparkles, Droplet, Users } from 'lucide-react';

interface DepartmentFilterProps {
  active: DepartmentKey | 'All';
  onChange: (dept: DepartmentKey | 'All') => void;
  departments: DepartmentKey[];
}

export function DepartmentFilter({ active, onChange, departments }: DepartmentFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const counts = getDepartmentCounts();

  const tabs: Array<{ key: DepartmentKey | 'All'; label: string; count: number }> = [
    { key: 'All', label: 'All Doctors', count: departments.reduce((s, d) => s + counts[d], 0) },
    ...departments.map((d) => ({ key: d, label: d, count: counts[d] })),
  ];

  const getIcon = (key: string, isActive: boolean) => {
    const iconClass = "w-4 h-4";
    if (key === 'All') return <Users className={cn(iconClass, isActive ? 'text-white' : 'text-[#1a4a8d]')} />;
    if (key.includes('Cardio')) return <Heart className={cn(iconClass, 'text-rose-500')} />;
    if (key.includes('Derma')) return <Sparkles className={cn(iconClass, 'text-purple-500')} />;
    if (key.includes('Endoc')) return <Droplet className={cn(iconClass, 'text-emerald-500')} />;
    return <User className={cn(iconClass, 'text-slate-400')} />;
  };

  return (
    <div className="relative w-full overflow-hidden">
      <div
        ref={scrollRef}
        className="scrollbar-hide flex gap-3 overflow-x-auto pb-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          
          return (
            <button
              key={tab.key}
              onClick={() => { onChange(tab.key); }}
              className={cn(
                'group relative flex shrink-0 items-center gap-2 rounded-full px-4 h-10 border transition-all duration-200 outline-none',
                isActive
                  ? 'bg-[#1a4a8d] border-[#1a4a8d] text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50'
              )}
            >
              {getIcon(tab.key, isActive)}
              <span className="whitespace-nowrap text-[13px] font-semibold">{tab.label}</span>

              {/* Count badge */}
              <span
                className={cn(
                  'flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ml-1',
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-500'
                )}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
