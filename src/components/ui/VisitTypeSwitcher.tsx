import { cn } from '@/lib/utils';
import { useState } from 'react';
import { IoAddOutline, IoSearchOutline, IoArrowForwardOutline } from 'react-icons/io5';

export interface VisitTypeOption {
  id: string;
  title: string;
  duration: string;
}

export interface VisitTypeSwitcherProps {
  options: VisitTypeOption[];
  defaultSelected?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function VisitTypeSwitcher({ options, defaultSelected, onChange, className }: VisitTypeSwitcherProps) {
  const [selected, setSelected] = useState(defaultSelected || options[0]?.id);

  const handleSelect = (id: string) => {
    setSelected(id);
    onChange?.(id);
  };

  return (
    <div className={cn('bg-brand-700 rounded-[20px] p-5 text-white', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[13px] font-bold">Visit Type</h3>
        <div className="flex gap-2">
          <button className="h-8 w-8 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/30 transition-colors">
            <IoSearchOutline className="h-4 w-4" />
          </button>
          <button className="h-8 w-8 rounded-full bg-black/20 flex items-center justify-center hover:bg-black/30 transition-colors">
            <IoAddOutline className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {options.map((option) => {
          const isActive = selected === option.id;
          return (
            <button
              key={option.id}
              onClick={() => handleSelect(option.id)}
              className={cn(
                'flex flex-col items-start p-4 rounded-xl text-left transition-all duration-300 relative overflow-hidden',
                isActive ? 'bg-white/15 shadow-inner' : 'bg-black/20'
              )}
            >
              <span className={cn("font-semibold text-sm", isActive ? 'text-white' : 'text-white/70')}>
                {option.title}
              </span>
              <span className={cn("text-[10px] font-bold mt-1", isActive ? 'text-brand-200' : 'text-white/50')}>
                {option.duration}
              </span>
              
              <div className={cn(
                "absolute bottom-4 right-4 h-6 w-6 rounded-full flex items-center justify-center",
                isActive ? "bg-white text-brand-700" : "bg-white/10 text-white/50"
              )}>
                <IoArrowForwardOutline className="h-3 w-3" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
