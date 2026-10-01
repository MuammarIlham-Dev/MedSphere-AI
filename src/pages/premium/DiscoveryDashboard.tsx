import { FilterChip } from '@/components/ui/FilterChip';
import { BottomNavDock } from '@/components/ui/BottomNavDock';
import { AvatarStack } from '@/components/ui/AvatarStack';
import { IoNotificationsOutline, IoCalendarOutline, IoPersonOutline, IoChevronForward, IoHeart, IoDocumentTextOutline, IoPulseOutline, IoFitnessOutline, IoHome } from 'react-icons/io5';
import { usePopReveal } from '@/lib/animations/gsap';

export default function DiscoveryDashboard() {
  const containerRef = usePopReveal(0.1);

  const dockItems = [
    { id: 'home', label: 'Home', icon: <IoHome />, onClick: () => {} },
    { id: 'appointments', label: 'Appointments', icon: <IoCalendarOutline />, onClick: () => {} },
    { id: 'reports', label: 'Reports', icon: <IoDocumentTextOutline />, onClick: () => {} },
    { id: 'profile', label: 'Profile', icon: <IoPersonOutline />, onClick: () => {} },
  ];

  return (
    <div className="min-h-screen bg-surface-canvas pb-32">
      
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface-canvas/90 backdrop-blur-md px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="https://i.pravatar.cc/150?img=47" alt="Alex Morgan" className="h-10 w-10 rounded-full border-[1.5px] border-border-subtle object-cover" />
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted">Good Morning,</span>
            <span className="text-[14px] font-bold text-text-headline">Alex Morgan</span>
          </div>
        </div>
        <button className="h-9 w-9 rounded-full bg-white border border-border-subtle flex items-center justify-center relative shadow-sm">
          <IoNotificationsOutline className="text-gray-600 text-lg" />
          <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-brand-pulse-red border-2 border-white box-content" />
        </button>
      </header>

      <main ref={containerRef} className="px-4 py-2 space-y-8">
        
        {/* Page Title */}
        <h1 className="text-[22px] leading-[28px] font-bold text-text-headline max-w-[200px]">
          Book an Appointment
        </h1>

        {/* Category Filter Ribbon */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          <FilterChip active>All</FilterChip>
          <FilterChip>Cardiologist</FilterChip>
          <FilterChip>Checkup</FilterChip>
          <FilterChip>Test & Scan</FilterChip>
        </div>

        {/* Hero Schedule Card */}
        <section className="bg-gradient-to-br from-brand-600 to-brand-800 rounded-[20px] p-4 text-white shadow-hero">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="h-7 w-7 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <IoHeart className="text-white text-sm" />
              </div>
              <span className="text-[14px] font-semibold">Cardiologist Appointment</span>
            </div>
            <div className="bg-black/25 backdrop-blur-md px-2 py-1 rounded-full">
              <span className="text-[10px] font-bold tracking-wide">10:00 - 10:30 AM</span>
            </div>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <AvatarStack 
              avatars={[
                { src: 'https://i.pravatar.cc/100?img=33', alt: 'Doctor 1' },
                { src: 'https://i.pravatar.cc/100?img=12', alt: 'Doctor 2' },
                { src: 'https://i.pravatar.cc/100?img=5', alt: 'Doctor 3' }
              ]} 
              limit={3} 
            />
            <span className="text-[10px] text-[#FECDD3] font-medium tracking-wide">5 Doctors available</span>
          </div>

          <div className="h-px w-full bg-white/10 mb-4" />

          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[13px] font-bold">Dr. James Anderson</span>
              <span className="text-[10px] text-[#FECDD3] font-medium mt-0.5">Senior Cardiologist</span>
            </div>
            <button className="h-8 w-8 rounded-full bg-white flex items-center justify-center shadow-sm">
              <IoChevronForward className="text-brand-700 text-sm" />
            </button>
          </div>
        </section>

        {/* Diagnostic Centers */}
        <section className="space-y-4">
          {/* Card 1 */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-rose flex items-center justify-center text-brand-700 text-xl">
                  <IoPulseOutline />
                </div>
                <span className="font-semibold text-[13px] text-text-headline">Echocardiogram</span>
              </div>
              <div className="bg-surface-subtle px-2 py-1 rounded-full border border-border-subtle">
                <span className="text-[10px] font-bold text-text-muted">11:30 - 12:00 PM</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <AvatarStack avatars={[{ src: 'https://i.pravatar.cc/100?img=6', alt: 'Doctor 4' }, { src: 'https://i.pravatar.cc/100?img=7', alt: 'Doctor 5' }]} limit={2} />
              <span className="text-[9px] font-medium text-text-muted">3 Slots available</span>
            </div>
            <div className="h-px w-full bg-border-subtle mb-3" />
            <div className="flex items-center justify-between text-text-body">
              <span className="text-[11px] font-medium">Cardiac Diagnostic Center</span>
              <IoChevronForward className="text-gray-400" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="bg-surface-card border border-border-subtle rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-brand-rose flex items-center justify-center text-brand-700 text-xl">
                  <IoFitnessOutline />
                </div>
                <span className="font-semibold text-[13px] text-text-headline">TMT (Stress Test)</span>
              </div>
              <div className="bg-surface-subtle px-2 py-1 rounded-full border border-border-subtle">
                <span className="text-[10px] font-bold text-text-muted">02:00 - 02:30 PM</span>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <AvatarStack avatars={[{ src: 'https://i.pravatar.cc/100?img=8', alt: 'Doctor 6' }]} limit={1} />
              <span className="text-[9px] font-medium text-text-muted">2 Slots available</span>
            </div>
            <div className="h-px w-full bg-border-subtle mb-3" />
            <div className="flex items-center justify-between text-text-body">
              <span className="text-[11px] font-medium">Cardiac Wellness Center</span>
              <IoChevronForward className="text-gray-400" />
            </div>
          </div>
        </section>

      </main>

      <BottomNavDock items={dockItems} activeId="home" />
    </div>
  );
}
