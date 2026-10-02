import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/CustomSelect';
import { useState, useEffect, useRef } from 'react';
import { IoSearchOutline, IoCloseOutline } from 'react-icons/io5';
import { MapPin, ChevronDown, ArrowDownUp, Building2, Stethoscope, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DoctorCard, type SupabaseDoctor } from '@/components/hospital/DoctorCard';
import { EmptyState } from '@/components/ui/KpiCard';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

import { PageTransition } from '@/components/transitions/PageTransition';
import { useReveal } from '@/lib/gsap';

type SortKey = 'rating' | 'fee' | 'experience';

export function HospitalDirectory() {
  const [activeCity, setActiveCity] = useState<string>('All');
  const [activeHospital, setActiveHospital] = useState<string>('All');
  const [activeDept, setActiveDept] = useState<string>('All');
  const [activeGender, setActiveGender] = useState<string>('All');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('rating');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Guard flag
  const [hasSearched, setHasSearched] = useState(false);
  // We need to keep track of the *submitted* search params so the infinite query doesn't re-run immediately on typing
  const [searchParams, setSearchParams] = useState({
    city: 'All',
    hospital: 'All',
    dept: 'All',
    gender: 'All',
    query: '',
    sort: 'rating' as SortKey,
    sortOrder: 'desc' as 'asc' | 'desc'
  });

  // Fetch filter options
  const { data: cities } = useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data } = await supabase.from('distinct_cities').select('city');
      return data?.map(d => d.city) || [];
    }
  });

  const { data: hospitals } = useQuery({
    queryKey: ['hospitals', activeCity],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_filtered_hospitals', { p_city: activeCity });
      return data?.map((d: any) => d.hospital_name) || [];
    }
  });

  const { data: departments } = useQuery({
    queryKey: ['departments', activeHospital],
    queryFn: async () => {
      const { data } = await supabase.rpc('get_filtered_departments', { p_hospital: activeHospital });
      return data?.map((d: any) => d.specialty) || [];
    }
  });

  // Fallback logic
  useEffect(() => {
    if (activeHospital !== 'All' && hospitals && !hospitals.includes(activeHospital)) {
      setActiveHospital('All');
    }
  }, [hospitals, activeHospital]);

  useEffect(() => {
    if (activeDept !== 'All' && departments && !departments.includes(activeDept)) {
      setActiveDept('All');
    }
  }, [departments, activeDept]);

  const canSearch = query.trim().length >= 3 || activeCity !== 'All' || activeHospital !== 'All' || activeDept !== 'All' || activeGender !== 'All';

  const handleSearch = () => {
    if (!canSearch) return;
    setSearchParams({
      city: activeCity,
      hospital: activeHospital,
      dept: activeDept,
      gender: activeGender,
      query: query,
      sort: sort,
      sortOrder: sortOrder
    });
    setHasSearched(true);
  };

  const handleClear = () => {
    setActiveCity('All');
    setActiveHospital('All');
    setActiveDept('All');
    setActiveGender('All');
    setQuery('');
    setHasSearched(false);
  };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status
  } = useInfiniteQuery({
    queryKey: ['doctors', searchParams],
    enabled: hasSearched,
    queryFn: async ({ pageParam = 0 }) => {
      const pageSize = 5;
      const from = pageParam * pageSize;
      const to = from + pageSize - 1;

      let supaQuery = supabase
        .from('doctor_directory')
        .select('*', { count: 'exact' });

      if (searchParams.city !== 'All') supaQuery = supaQuery.eq('city', searchParams.city);
      if (searchParams.hospital !== 'All') supaQuery = supaQuery.eq('hospital_name', searchParams.hospital);
      if (searchParams.dept !== 'All') supaQuery = supaQuery.eq('specialty', searchParams.dept);
      if (searchParams.gender !== 'All') supaQuery = supaQuery.eq('gender', searchParams.gender.toLowerCase());

      if (searchParams.query.trim()) {
        const q = searchParams.query;
        supaQuery = supaQuery.or(`full_name.ilike.%${q}%,specialty.ilike.%${q}%,hospital_name.ilike.%${q}%`);
      }

      let sortColumn = 'rating_avg';
      if (searchParams.sort === 'fee') sortColumn = 'consultation_fee';
      else if (searchParams.sort === 'experience') sortColumn = 'experience_years';
      
      supaQuery = supaQuery.order(sortColumn, { ascending: searchParams.sortOrder === 'asc' });

      const { data, error, count } = await supaQuery.range(from, to);

      if (error) throw error;

      return {
        items: data as SupabaseDoctor[],
        totalCount: count || 0,
        nextPage: data.length === pageSize ? pageParam + 1 : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
  });

  const doctors = data?.pages.flatMap(page => page.items) || [];
  const totalCount = data?.pages[0]?.totalCount || 0;

  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage && !isFetching) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  // Sort effect: if we have searched, auto update search params when sort changes
  useEffect(() => {
    if (hasSearched) {
      setSearchParams(prev => ({ ...prev, sort, sortOrder }));
    }
  }, [sort, sortOrder, hasSearched]);

  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  return (
    <PageTransition>
      <div className="space-y-6" ref={rootRef}>
        {/* Advanced Search & Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4 dark:bg-surface-dark-soft dark:border-white/10">
        {/* Dropdowns Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* City */}
          <Select value={activeCity} onValueChange={setActiveCity}>
            <SelectTrigger className="py-2.5 text-sm" icon={<MapPin className="w-4 h-4" />}>
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Cities</SelectItem>
              {cities?.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Hospital */}
          <Select value={activeHospital} onValueChange={setActiveHospital}>
            <SelectTrigger className="py-2.5 text-sm" icon={<Building2 className="w-4 h-4" />}>
              <SelectValue placeholder="All Hospitals" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Hospitals</SelectItem>
              {hospitals?.map((h: string) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Department */}
          <Select value={activeDept} onValueChange={setActiveDept}>
            <SelectTrigger className="py-2.5 text-sm" icon={<Stethoscope className="w-4 h-4" />}>
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Departments</SelectItem>
              {departments?.map((d: string) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Gender */}
          <Select value={activeGender} onValueChange={setActiveGender}>
            <SelectTrigger className="py-2.5 text-sm" icon={<Users className="w-4 h-4" />}>
              <SelectValue placeholder="All Genders" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Genders</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search Bar Row */}
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <IoSearchOutline className="w-[18px] h-[18px] text-[#1a4a8d]" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type at least 3 characters to search by name or keyword..."
              className="w-full pl-9 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg text-[14px] text-slate-800 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 shadow-sm dark:bg-slate-900/50 dark:border-white/10 dark:text-slate-200 dark:placeholder:text-slate-500"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                <IoCloseOutline className="w-5 h-5" />
              </button>
            )}
          </div>
          
          <button
            onClick={handleSearch}
            disabled={!canSearch || (isFetching && !isFetchingNextPage)}
            className="px-6 py-2.5 rounded-lg bg-[#225091] hover:bg-[#1a3d6e] disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-[14px] font-semibold transition-colors flex items-center gap-2 shadow-sm shrink-0"
          >
            {isFetching && !isFetchingNextPage ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <IoSearchOutline className="w-[16px] h-[16px]" />
            )}
            <span>Find Doctor</span>
          </button>
        </div>

        {/* Sort and Clear Row */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-slate-500 font-medium">Sort by:</span>
            <div className="relative flex items-center gap-2">
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="h-8 py-1.5 px-2 border-none bg-transparent hover:bg-slate-100/50 text-[13px] font-bold text-slate-700 w-auto gap-1 focus:ring-0 shadow-none dark:text-slate-300 dark:hover:bg-slate-800">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start">
                  <SelectItem value="rating">Rating</SelectItem>
                  <SelectItem value="fee">Fee</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                </SelectContent>
              </Select>
              <button
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-400"
                title={sortOrder === 'desc' ? 'High to Low' : 'Low to High'}
              >
                <ArrowDownUp className="w-4 h-4" />
              </button>
            </div>
          </div>

          {(activeCity !== 'All' || activeHospital !== 'All' || activeDept !== 'All' || activeGender !== 'All' || query || hasSearched) && (
            <button
              onClick={handleClear}
              className="text-[13px] text-brand-600 hover:underline font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {!hasSearched ? (
        <EmptyState
          title="Find Your Doctor"
          hint="Select a city, hospital, or department from above, or type at least 3 characters to search."
        />
      ) : status === 'pending' ? (
        <div className="flex justify-center p-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1a4a8d]"></div>
        </div>
      ) : status === 'error' ? (
        <EmptyState
          title="Error loading doctors"
          hint="Please check your connection and try again."
        />
      ) : doctors.length === 0 ? (
        <EmptyState
          title="No doctors found"
          hint="Try adjusting your filters or search query."
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <p className="text-sm text-slate-600">
              Found <span className="font-semibold text-slate-900">{totalCount}</span> doctor{totalCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            {doctors.map((doctor, i) => (
              <DoctorCard
                key={doctor.id}
                doctor={doctor}
                style={{ animationDelay: `${String(Math.min((i % 5) * 40, 200))}ms` }}
              />
            ))}
            
            {/* Intersection Observer target for exactly 5 items at a time */}
            <div ref={loadMoreRef} className="h-10 w-full flex items-center justify-center py-4">
              {isFetchingNextPage ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1a4a8d]"></div>
                  <span className="text-sm font-medium text-slate-500">Loading more...</span>
                </div>
              ) : hasNextPage ? (
                <span className="text-sm text-slate-400">Scroll down to load more</span>
              ) : (
                <span className="text-sm text-slate-400">You've reached the end of the results</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Attribution */}
      <p className="pt-8 text-center text-[10px] text-slate-400 dark:text-slate-500">
        Source: MedSphere AI Registry V1 · 13 Aug 2026 ·{' '}
        <span className="text-amber-500">Live schedules vary — confirm by phone before visit.</span>
      </p>
    </div>
    </PageTransition>
  );
}

export default HospitalDirectory;
