import {
  IoBusinessOutline,
  IoLocationOutline,
  IoCallOutline,
  IoPeopleOutline,
  IoGridOutline,
  IoCheckmarkCircleOutline,
} from 'react-icons/io5';
import { HOSPITAL_INFO } from '@/data/popularDiagnosticRajshahi';

export function HospitalInfoBanner() {
  const h = HOSPITAL_INFO;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand-200/60 bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 p-6 text-white shadow-lift dark:border-brand-800/60">
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-8 right-24 h-24 w-24 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute bottom-4 left-1/3 h-16 w-16 rounded-full bg-brand-400/20" />

      <div className="relative flex flex-wrap items-start justify-between gap-6">
        {/* Left: hospital identity */}
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20">
            <IoBusinessOutline className="h-7 w-7 text-white" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">{h.name}</h2>
              <span className="flex items-center gap-1 rounded-full bg-green-400/20 px-2 py-0.5 text-[10px] font-semibold text-green-300 ring-1 ring-green-400/30">
                <IoCheckmarkCircleOutline className="h-3 w-3" />
                Verified
              </span>
            </div>
            <p className="mt-0.5 text-sm font-medium text-brand-200">{h.branch} Branch</p>
            <p className="mt-0.5 text-xs text-brand-300">{h.type}</p>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5 text-xs text-brand-200">
                <IoLocationOutline className="h-3.5 w-3.5" />
                Laxmipur, Rajshahi
              </span>
              <a
                href={`tel:${h.phone}`}
                className="flex items-center gap-1.5 text-xs text-brand-200 transition-colors hover:text-white"
              >
                <IoCallOutline className="h-3.5 w-3.5" />
                {h.phone}
              </a>
            </div>
          </div>
        </div>

        {/* Right: stats */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-center backdrop-blur-sm ring-1 ring-white/10">
            <IoPeopleOutline className="mb-1 h-5 w-5 text-brand-200" />
            <p className="text-2xl font-bold">{h.totalDoctors}</p>
            <p className="text-[10px] font-medium text-brand-300">Specialists</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-xl bg-white/10 px-5 py-3 text-center backdrop-blur-sm ring-1 ring-white/10">
            <IoGridOutline className="mb-1 h-5 w-5 text-brand-200" />
            <p className="text-2xl font-bold">{h.totalDepartments}</p>
            <p className="text-[10px] font-medium text-brand-300">Departments</p>
          </div>
        </div>
      </div>

      {/* Address strip */}
      <div className="relative mt-4 flex items-center gap-1.5 rounded-xl bg-white/10 px-4 py-2.5 text-xs text-brand-200 backdrop-blur-sm ring-1 ring-white/10">
        <IoLocationOutline className="h-3.5 w-3.5 shrink-0" />
        <span>{h.address}</span>
      </div>
    </div>
  );
}
