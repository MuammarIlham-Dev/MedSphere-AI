import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { bedService } from '@/services/bed.service';

const invalidate = (queryClient: ReturnType<typeof useQueryClient>, id?: string) => {
  for (const key of [
    'hospital-beds',
    'hospital-bed-requests',
    'hospital-bed-reservations',
    'hospital-admissions',
    'my-bed-requests',
    'public-bed-availability',
  ]) {
    void queryClient.invalidateQueries({ queryKey: [key, id] });
  }
};

export const usePublicBedAvailability = (city?: string) =>
  useQuery({
    queryKey: ['public-bed-availability', city],
    queryFn: () => bedService.availability(city),
    staleTime: 15_000,
    refetchInterval: 20_000,
  });

export const useMyBedRequests = () => {
  const profile = useAuthStore((s) => s.profile);
  return useQuery({
    queryKey: ['my-bed-requests', profile?.id],
    queryFn: () => bedService.my(profile!.id),
    enabled: !!profile?.id,
    refetchInterval: 20_000,
  });
};

export const useRequestBed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bedService.request,
    onSuccess: () => invalidate(queryClient),
  });
};

export const useCancelBedRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: bedService.cancel,
    onSuccess: () => invalidate(queryClient),
  });
};

export const useHospitalBeds = (id?: string) =>
  useQuery({
    queryKey: ['hospital-beds', id],
    queryFn: () => bedService.beds(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

export const useHospitalBedRequests = (id?: string) =>
  useQuery({
    queryKey: ['hospital-bed-requests', id],
    queryFn: () => bedService.requests(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

export const useHospitalBedReservations = (id?: string) =>
  useQuery({
    queryKey: ['hospital-bed-reservations', id],
    queryFn: () => bedService.reservations(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

export const useHospitalAdmissions = (id?: string) =>
  useQuery({
    queryKey: ['hospital-admissions', id],
    queryFn: () => bedService.admissions(id!),
    enabled: !!id,
    refetchInterval: 15_000,
  });

type CreateBedInput = {
  hospital_id: string;
  ward_name: string;
  bed_number: string;
  category: string;
  citizen_visible: boolean;
  citizen_requestable: boolean;
  emergency_only: boolean;
};

type ApproveBedInput = { requestId: string; bedId?: string };
type AdmissionActionInput = { admissionId: string };

export const useCreateHospitalBed = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBedInput) => bedService.add(input),
    onSuccess: (_, input) => invalidate(queryClient, input.hospital_id),
  });
};

export const useApproveBedRequest = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApproveBedInput) => bedService.approve(input.requestId, input.bedId),
    onSuccess: () => invalidate(queryClient, hospitalId),
  });
};

export const useAdmitBedReservation = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) => bedService.admit(reservationId),
    onSuccess: () => invalidate(queryClient, hospitalId),
  });
};

export const useDischargeAdmission = (hospitalId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AdmissionActionInput) => bedService.discharge(input.admissionId),
    onSuccess: () => invalidate(queryClient, hospitalId),
  });
};
