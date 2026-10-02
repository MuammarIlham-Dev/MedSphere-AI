import { Select } from '@/components/ui/Input';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { VisitTypeSwitcher } from '@/components/ui/VisitTypeSwitcher';
import { IoArrowBack, IoShareSocialOutline, IoStar } from 'react-icons/io5';
import { useNavigate } from 'react-router-dom';
import { usePopReveal } from '@/lib/animations/gsap';

export default function ConsultationDetail() {
  const navigate = useNavigate();
  const containerRef = usePopReveal(0.1);

  const [selectedDate, setSelectedDate] = useState('Wed 24');
  const [selectedTime, setSelectedTime] = useState('10:00 AM');

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md px-4 py-4 flex items-center justify-between border-b border-border-subtle">
        <button 
          onClick={() => navigate('/premium/discover')}
          className="h-10 w-10 rounded-full border border-border-subtle flex items-center justify-center text-text-headline hover:bg-surface-subtle transition-colors"
        >
          <IoArrowBack size={20} />
        </button>
        <h1 className="text-[16px] font-bold text-text-headline">Dr. Sarah Jenkins</h1>
        <button className="h-10 w-10 rounded-full border border-border-subtle flex items-center justify-center text-text-headline hover:bg-surface-subtle transition-colors">
          <IoShareSocialOutline size={20} />
        </button>
      </header>

      <main ref={containerRef} className="px-4 py-6 space-y-8">
        
        {/* Doctor Profile Summary */}
        <section className="flex flex-col items-center text-center relative pt-8">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120%] h-32 bg-brand-rose/30 rounded-[100%] blur-xl -z-10" />
          
          <div className="relative mb-4">
            <img src="https://i.pravatar.cc/300?img=47" alt="Dr. Sarah Jenkins" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-soft" />
            <div className="absolute -bottom-2 -right-2 bg-white px-2 py-1 rounded-full shadow-sm flex items-center gap-1 border border-border-subtle">
              <IoStar className="text-yellow-400 text-xs" />
              <span className="text-[10px] font-bold">4.9</span>
            </div>
          </div>
          
          <h2 className="text-[22px] font-bold text-text-headline mb-1">Dr. Sarah Jenkins</h2>
          <p className="text-[13px] font-medium text-text-muted">Cardiologist • 12 Yrs Exp</p>
        </section>

        {/* About */}
        <section>
          <h3 className="text-[15px] font-bold text-text-headline mb-2">About</h3>
          <p className="text-[13px] leading-[20px] text-text-body">
            Dr. Jenkins is a renowned cardiologist specializing in early diagnosis and preventative heart care. She focuses on providing personalized and advanced diagnostic evaluations.
          </p>
        </section>

        {/* Visit Type */}
        <section>
          <VisitTypeSwitcher 
            options={[
              { id: 'initial', title: 'Initial Consultation', duration: '30 min' },
              { id: 'followup', title: 'Follow-up Consultation', duration: '20 min' }
            ]}
          />
        </section>

        {/* Date & Time Selection */}
        <section>
          <h3 className="text-[15px] font-bold text-text-headline mb-4">Select Date & Time</h3>
          
          {/* Dates Ribbon */}
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide -mx-4 px-4 mb-2">
            {['Mon 22', 'Tue 23', 'Wed 24', 'Thu 25', 'Fri 26'].map((date) => {
              const isActive = date === selectedDate;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={`shrink-0 flex flex-col items-center justify-center w-[60px] h-[72px] rounded-2xl border transition-all ${
                    isActive 
                      ? 'bg-brand-700 border-brand-700 text-white shadow-md' 
                      : 'bg-white border-border-subtle text-text-muted hover:border-gray-300'
                  }`}
                >
                  <span className={`text-[10px] uppercase font-bold ${isActive ? 'text-brand-200' : ''}`}>
                    {date.split(' ')[0]}
                  </span>
                  <span className={`text-[18px] font-extrabold mt-1 ${isActive ? 'text-white' : 'text-text-headline'}`}>
                    {date.split(' ')[1]}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Time Grid */}
          <div className="grid grid-cols-3 gap-3">
            {['09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'].map((time) => {
              const isActive = time === selectedTime;
              return (
                <button
                  key={time}
                  onClick={() => setSelectedTime(time)}
                  className={`py-3 rounded-xl border text-[12px] font-semibold transition-all ${
                    isActive
                      ? 'bg-brand-rose border-brand-700 text-brand-900 shadow-sm'
                      : 'bg-white border-border-subtle text-text-body hover:border-gray-300'
                  }`}
                >
                  {time}
                </button>
              );
            })}
          </div>
        </section>

      </main>

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border-subtle p-4 pb-safe shadow-[0_-8px_24px_rgba(0,0,0,0.03)] flex items-center justify-between z-50">
        <div className="flex flex-col">
          <span className="text-[11px] text-text-muted font-medium">Total Price</span>
          <span className="text-[20px] font-extrabold text-brand-900">$150.00</span>
        </div>
        <Button className="h-14 px-8 rounded-full shadow-hero text-[14px]">
          Confirm Booking
        </Button>
      </div>
    </div>
  );
}
