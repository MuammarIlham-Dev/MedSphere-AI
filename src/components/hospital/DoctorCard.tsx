import { Badge } from '@/components/ui/Badge';
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  MapPin,
  MessageCircle,
  Star,
  Stethoscope,
  ArrowRight,
  BadgeDollarSign,
  Building2,
  CircleUser,
  Heart,
  Brain,
  Bone,
  Eye,
  Baby,
  Activity,
  Microscope,
  Ear,
  Sparkles
} from "lucide-react";

// Helper for department styling
const getDepartmentStyle = (specialty: string) => {
  const spec = specialty.toLowerCase();
  
  if (spec.includes('cardio')) return { icon: Heart, colors: 'bg-rose-100 text-rose-500', fill: 'fill-rose-500/50' };
  if (spec.includes('neuro')) return { icon: Brain, colors: 'bg-purple-100 text-purple-600', fill: 'fill-purple-600/50' };
  if (spec.includes('ortho')) return { icon: Bone, colors: 'bg-amber-100 text-amber-600', fill: 'fill-amber-600/50' };
  if (spec.includes('opthal') || spec.includes('eye')) return { icon: Eye, colors: 'bg-cyan-100 text-cyan-600', fill: 'fill-cyan-600/50' };
  if (spec.includes('pedia')) return { icon: Baby, colors: 'bg-pink-100 text-pink-500', fill: 'fill-pink-500/50' };
  if (spec.includes('ent') || spec.includes('ear')) return { icon: Ear, colors: 'bg-orange-100 text-orange-600', fill: 'fill-orange-600/50' };
  if (spec.includes('patho') || spec.includes('lab')) return { icon: Microscope, colors: 'bg-emerald-100 text-emerald-600', fill: 'fill-emerald-600/50' };
  if (spec.includes('surge')) return { icon: Activity, colors: 'bg-red-100 text-red-600', fill: 'fill-red-600/50' };
  if (spec.includes('derma')) return { icon: Sparkles, colors: 'bg-fuchsia-100 text-fuchsia-600', fill: 'fill-fuchsia-600/50' };
  
  return { icon: Stethoscope, colors: 'bg-blue-100 text-blue-600', fill: 'fill-blue-600/50' };
};
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { BookingModal } from './BookingModal';

export interface SupabaseDoctor {
  id: string;
  specialty: string;
  qualifications: string[];
  experience_years: number;
  consultation_fee: number;
  full_name: string;
  avatar_url: string | null;
  city: string | null;
  gender: string | null;
  phone: string | null;
  hospital_id?: string | null;
  hospital_name: string | null;
  rating_avg: number;
  rating_count: number;
  bio: string | null;
}

interface DoctorCardProps {
  doctor: SupabaseDoctor;
  style?: React.CSSProperties;
}

export function DoctorCard({ doctor, style }: DoctorCardProps) {
  const navigate = useNavigate();
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const avatarSrc = doctor.avatar_url ?? '/doctor-avatar.jpg';
  
  const nameParts = (doctor.full_name || 'Dr').split(' ').filter(Boolean);
  const initials = nameParts.length > 1 
    ? ((nameParts[0]?.[0] || '') + (nameParts[nameParts.length - 1]?.[0] || '')).toUpperCase() || 'DR'
    : (nameParts[0]?.[0] || 'D').toUpperCase();

  // Deriving fallback/mock values to fully showcase the UI
  const credentials = doctor.qualifications || [];
  const rating = doctor.rating_avg.toFixed(1);
  const reviewCount = doctor.rating_count;
  
  const specializations = doctor.specialty.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3);
  const primarySpecialty = specializations[0] || 'General';
  const deptStyle = getDepartmentStyle(primarySpecialty);
  const DeptIcon = deptStyle.icon;
  
  // Create a realistic description based on actual db data
  const description = doctor.bio || `${doctor.full_name} is a renowned ${specializations[0] || 'Medical Professional'} with over ${doctor.experience_years || 0} years of experience in the field of ${doctor.specialty}. Dedicated to providing comprehensive and compassionate care to patients.`;

  // Determine designation from qualifications or fallback
  const designation = credentials.some(q => q.toLowerCase().includes('prof')) ? 'Professor' : 'Doctor';

  // Format fee
  const consultationFee = doctor.consultation_fee > 0 ? doctor.consultation_fee.toString() : '500';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-20px" }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      style={style}
      className={cn(
        "group w-full rounded-xl bg-white border border-slate-100 shadow-sm",
        "transition-all duration-300 lg:hover:shadow-lg lg:hover:border-blue-200 lg:hover:-translate-y-1",
        "flex flex-col lg:flex-row p-3.5 gap-4"
      )}
    >
      {/* Left Column: Fixed Avatar */}
      <div className="relative shrink-0 w-full lg:w-[180px] h-[220px] rounded-lg overflow-hidden bg-slate-50">
        <img
          src={avatarSrc}
          alt={doctor.full_name}
          className="w-full h-full object-cover object-top"
          loading="lazy"
          onError={(e) => {
            const t = e.currentTarget.parentElement;
            if (t) {
              e.currentTarget.style.display = 'none';
              t.innerHTML = `<span class="flex h-full w-full items-center justify-center text-3xl font-bold text-slate-400 bg-slate-100">${initials}</span>`;
            }
          }}
        />
        
        {/* Available Today Badge */}
        <div className="absolute top-1.5 left-1 flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-50 text-emerald-600 shadow-sm border border-emerald-100">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span className="text-[10px] font-bold tracking-wide">Available Today</span>
        </div>

        {/* Rating Badge */}
        <div className="absolute bottom-1 left-1.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-900/80 shadow-sm backdrop-blur-sm">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-[12px] font-bold text-white">{rating}</span>
          <span className="text-[10px] font-medium text-slate-300">({reviewCount} reviews)</span>
        </div>
      </div>

      {/* Middle Column: Doctor Details */}
      <div className="flex-1 flex flex-col min-w-0 pt-1 pb-1 lg:pr-4">
        {/* Header row: Department Pill & Mobile Favorite */}
        <div className="flex items-center justify-between mb-2">
          <div className={cn("flex items-center gap-1.5 w-fit px-1.5 py-1 rounded-lg", deptStyle.colors)}>
            <DeptIcon className={cn("w-3.5 h-3.5 stroke-[2.5]", deptStyle.fill)} />
            <span className="text-[11px] font-bold">{primarySpecialty}</span>
          </div>
          {/* Favorite Icon (Mobile/Tablet only) */}
          <button className="lg:hidden text-slate-400 hover:text-rose-500 transition-colors">
            <Heart className="w-5 h-5 stroke-[2]" />
          </button>
        </div>
        
        {/* Name */}
        <h3 className="text-lg font-bold text-slate-900 leading-snug mb-0.5 truncate">
          {doctor.full_name}
        </h3>

        {/* Credentials */}
        <p className="text-[12px] text-slate-700 font-normal truncate mb-2">
          {credentials.join(' \u00A0\u00A0•\u00A0\u00A0 ')}
        </p>

        {/* Designation Chip */}
        <div className="hidden lg:flex items-center gap-1.5 mb-2 w-fit px-1.5 py-1 rounded-lg bg-blue-50 text-blue-600">
          <CircleUser className="w-4 h-4 stroke-[2]" />
          <span className="text-xs font-bold">{designation}</span>
        </div>

        {/* Description */}
        <p className="text-[12px] text-slate-600 leading-relaxed line-clamp-2 pr-0">
          {description}
        </p>

        {/* Bottom Details Grid */}
        <div className="mt-3 flex items-center gap-6 lg:justify-between pt-3 border-t border-slate-250">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-slate-600 stroke-[1.5] shrink-0 -mt-3" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-600 truncate">{doctor.experience_years || '10'}+ years</span>
              <span className="text-[10px] text-slate-600 truncate">experience</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-600 stroke-[1.5] shrink-0 -mt-3" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-600 truncate">{doctor.city || 'Rajshahi'}</span>
              <span className="text-[10px] text-slate-600 truncate">{doctor.hospital_name || 'Popular Diagnostic'}</span>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-1.5">
            <Building2 className="w-4 h-4 text-slate-600 stroke-[1.5] shrink-0 -mt-3" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] font-bold text-slate-600 truncate">{credentials[0] || 'MBBS'}</span>
              <span className="text-[10px] text-slate-600 truncate">{doctor.specialty.split(',')[0]}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Column: Booking & Details */}
      <div className="shrink-0 w-full lg:w-[280px] xl:w-[300px] lg:pl-5 border-t lg:border-t-0 lg:border-l border-dashed border-slate-200 flex flex-col relative pt-1">
        {/* Favorite Icon (Desktop only) */}
        <button className="hidden lg:block absolute top-0 right-0 text-slate-400 hover:text-rose-500 transition-colors">
          <Heart className="w-5 h-5 stroke-[2]" />
        </button>

        <div className="flex flex-col gap-2 flex-1 mt-1">
          {/* Consultation Fee */}
          <div className="flex gap-2 items-start pb-2">
            <BadgeDollarSign className="w-4.5 h-4.5 text-[#1a4a8d] stroke-[2.5] bg-[#1a4a8d]/10 rounded-lg p-1 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-700 mb-0.5">Consultation Fee</span>
              <div className="flex items-baseline gap-2 -mt-1">
                <span className="text-[22px] font-bold text-slate-900">৳</span><span className="text-[18px] font-bold text-slate-900">{consultationFee}</span>
                <span className="relative -top-[3px] px-1.5 py-1 rounded bg-emerald-50 text-emerald-800 text-[10px] font-bold tracking-wide">(In-person)</span>
              </div>
            </div>
          </div>

          {/* Next Available */}
          <div className="flex gap-2 items-start pb-2">
            <CalendarDays className="w-4.5 h-4.5 text-[#1a4a8d] stroke-[2.5] bg-[#1a4a8d]/10 rounded-lg p-1 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-700 mb-0.5">Next Available</span>
              <div className="flex items-center gap-3 pb-1">
                <span className="text-[14px] font-bold text-slate-900 truncate">Check Schedules</span>
                <button 
                  onClick={() => setIsBookingOpen(true)}
                  className="text-[11px] font-semibold text-[#1a4a8d] hover:text-blue-700 hover:underline flex items-center gap-0.5 shrink-0">
                  View all slots
                  <ArrowRight className="w-3 h-3 stroke-[2]" />
                </button>
              </div>
            </div>
          </div>

          {/* Specializations */}
          <div className="hidden lg:flex gap-2 items-start">
            <Stethoscope className="w-4.5 h-4.5 text-[#1a4a8d] stroke-[2.5] bg-[#1a4a8d]/10 rounded-lg p-1 shrink-0" />
            <div className="flex flex-col">
              <span className="text-[12px] font-semibold text-slate-700 mb-0.5">Specializations</span>
              <div className="flex flex-wrap items-center gap-1.5">
                {specializations.map((spec, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full bg-blue-50/80 text-blue-600 text-[10px] font-bold">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mt-3">
          <button
            onClick={() => setIsBookingOpen(true)}
            className="flex-1 max-w-44 h-8 rounded-lg bg-[#1a4a8d] hover:bg-[#12366b] text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
          >
            <CalendarDays className="w-[15px] h-[15px]" />
            Book Appointment
          </button>
          <a
            href={`tel:${doctor.phone || ''}`}
            className="shrink-0 h-8 px-4 flex items-center justify-center gap-2 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-[13px] font-bold transition-colors bg-white shadow-sm"
          >
            <MessageCircle className="w-[15px] h-[15px] text-slate-700" />
            Message
          </a>
        </div>
      </div>
      
      {/* Booking Modal */}
      {isBookingOpen && (
        <BookingModal
          doctor={doctor}
          isOpen={isBookingOpen}
          onClose={() => setIsBookingOpen(false)}
        />
      )}
    </motion.div>
  );
}
