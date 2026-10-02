import { useState, useRef, useEffect, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { IoInformationCircleOutline } from 'react-icons/io5';

interface PopoverProps {
  children: ReactNode;
  icon?: ReactNode;
}

export function Popover({ children, icon }: PopoverProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [ref]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="text-slate-400 hover:text-slate-600 focus:outline-none dark:hover:text-slate-200"
        aria-expanded={open}
        type="button"
      >
        {icon || <IoInformationCircleOutline className="h-5 w-5" />}
      </button>

      {open && (
        <div className="absolute left-1/2 z-50 mt-2 w-64 -translate-x-1/2 rounded-xl bg-white p-4 shadow-xl ring-1 ring-slate-900/5 dark:bg-slate-800 dark:ring-white/10 sm:w-72">
          {children}
        </div>
      )}
    </div>
  );
}
