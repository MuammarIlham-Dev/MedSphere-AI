import { usePopReveal } from '@/lib/animations/gsap';
import { IoHeart, IoChevronForward, IoPulseOutline } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';

export default function Onboarding() {
  const containerRef = usePopReveal(0);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-between p-6 relative overflow-hidden bg-gradient-to-b from-brand-burgundy to-brand-950 text-white pb-12 pt-16">
      
      {/* Header */}
      <div className="flex flex-col items-center z-10">
        <div className="text-brand-pulse-red text-3xl mb-2">
          <IoHeart />
        </div>
        <h2 className="text-[14px] font-bold">CardioLife</h2>
        <span className="text-[8px] uppercase tracking-[2px] text-[#F87171] mt-0.5">Heart Care</span>
      </div>

      {/* Center Visual Focal Point */}
      <div ref={containerRef} className="relative z-10 flex-1 flex flex-col items-center justify-center w-full max-w-sm">
        <div className="absolute inset-0 bg-brand-pulse-red/25 blur-[60px] rounded-full aspect-square" />
        <IoHeart className="text-9xl text-brand-600 drop-shadow-2xl z-10 animate-pulse" style={{ animationDuration: '900ms' }} />
        
        {/* Fake ECG line overlaying the heart */}
        <div className="absolute top-1/2 left-0 right-0 -translate-y-1/2 flex items-center justify-center opacity-80 z-20">
          <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-brand-pulse-red to-transparent shadow-[0_0_8px_rgba(220,38,38,0.8)]" />
          <IoPulseOutline className="absolute text-brand-pulse-red text-4xl" />
        </div>
      </div>

      {/* Lower Third */}
      <div className="w-full max-w-md z-10 flex flex-col gap-8">
        <div>
          <h1 className="text-[26px] leading-[32px] font-bold mb-3">
            Your Heart Deserves the <span className="text-brand-pulse-red">Best Care</span>
          </h1>
          <p className="text-[12px] leading-[18px] text-gray-300 font-medium">
            Advanced care for heart health. Early diagnosis. Better life.
          </p>
        </div>

        {/* Action Trigger Bar */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/premium/discover')}
            className="flex-1 h-14 bg-gradient-to-r from-[#801019] to-[#590A10] rounded-full flex items-center justify-between px-6 shadow-hero active:scale-95 transition-transform"
          >
            <span className="text-[13px] font-semibold text-white">Get Started</span>
            <IoChevronForward className="text-white text-lg" />
          </button>
          
          <button className="h-12 w-12 shrink-0 bg-white rounded-full flex items-center justify-center shadow-soft active:scale-95 transition-transform">
            <IoHeart className="text-brand-700 text-2xl" />
          </button>
        </div>
      </div>
    </div>
  );
}
