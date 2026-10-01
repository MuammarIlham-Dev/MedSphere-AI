import { cn } from '@/lib/utils';
import { Fragment } from 'react';

export interface Step {
  title: string;
  subtitle?: string;
}

export interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function ProgressStepper({ steps, currentStep, className }: ProgressStepperProps) {
  return (
    <div className={cn('flex items-start', className)}>
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;
        
        return (
          <Fragment key={index}>
            <div className="flex flex-col items-center group relative">
              <div
                className={cn(
                  'z-10 flex h-8 w-8 items-center justify-center rounded-full transition-all duration-300',
                  isActive
                    ? 'bg-brand-700 shadow-hero scale-110'
                    : isCompleted
                    ? 'bg-brand-600'
                    : 'bg-white border-2 border-border-subtle'
                )}
              >
                {(isActive || isCompleted) ? (
                  <div className="h-2.5 w-2.5 rounded-full bg-white" />
                ) : null}
              </div>
              <div className="mt-3 text-center w-24 absolute top-10">
                <p className={cn(
                  "text-xs font-semibold transition-colors duration-300",
                  isActive ? "text-brand-950" : isCompleted ? "text-brand-800" : "text-gray-400"
                )}>
                  {step.title}
                </p>
                {step.subtitle && (
                  <p className="text-[10px] mt-0.5 text-gray-500 font-medium">{step.subtitle}</p>
                )}
              </div>
            </div>

            {index < steps.length - 1 && (
              <div className="flex-1 px-2 mt-4 relative">
                <div className="border-t-2 border-dashed border-brand-300 w-full absolute top-1/2 -translate-y-1/2 left-0" />
                {isCompleted && (
                  <div className="border-t-2 border-brand-700 w-full absolute top-1/2 -translate-y-1/2 left-0 transition-all duration-500" />
                )}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
