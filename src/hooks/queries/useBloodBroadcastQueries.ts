import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bloodBroadcastService } from '@/services/bloodBroadcast.service';
import { useUiStore } from '@/stores/uiStore';

export function useDonorBloodBroadcasts() {
  const query = useQuery({ queryKey: ['blood-broadcasts','donor'], queryFn: bloodBroadcastService.donorBroadcasts, refetchInterval: 15000 });
  return query;
}
export function useMyBloodBroadcastResponses() {
  return useQuery({ queryKey: ['blood-broadcast-responses','mine'], queryFn: bloodBroadcastService.donorResponses, refetchInterval: 15000 });
}
export function useRespondToBloodBroadcast() {
  const qc=useQueryClient(); const toast=useUiStore(s=>s.toast);
  return useMutation({ mutationFn:bloodBroadcastService.respond, onSuccess:()=>{toast('success','You joined the donor response queue.');void qc.invalidateQueries({queryKey:['blood-broadcasts']});void qc.invalidateQueries({queryKey:['blood-broadcast-responses']});}, onError:e=>toast('error',e instanceof Error?e.message:'Unable to respond')});
}
export function useWithdrawBloodBroadcastResponse() {
  const qc=useQueryClient(); const toast=useUiStore(s=>s.toast);
  return useMutation({ mutationFn:bloodBroadcastService.withdraw, onSuccess:()=>{toast('success','Your donor response was withdrawn.');void qc.invalidateQueries({queryKey:['blood-broadcasts']});void qc.invalidateQueries({queryKey:['blood-broadcast-responses']});}, onError:e=>toast('error',e instanceof Error?e.message:'Unable to withdraw')});
}
export function useHospitalBloodBroadcasts(hospitalId?:string) {
  return useQuery({queryKey:['hospital-blood-broadcasts',hospitalId],queryFn:()=>bloodBroadcastService.hospitalBroadcasts(hospitalId!),enabled:!!hospitalId,refetchInterval:10000});
}
export function useHospitalBloodBroadcastResponses(requestId?:string) {
  return useQuery({queryKey:['hospital-blood-broadcast-responses',requestId],queryFn:()=>bloodBroadcastService.hospitalResponses(requestId!),enabled:!!requestId,refetchInterval:10000});
}
export function useCreateHospitalBloodBroadcast() {
  const qc=useQueryClient(); const toast=useUiStore(s=>s.toast);
  return useMutation({mutationFn:bloodBroadcastService.createHospitalBroadcast,onSuccess:(_,v)=>{toast('success','Blood broadcast activated');void qc.invalidateQueries({queryKey:['hospital-blood-broadcasts',v.hospitalId]});},onError:e=>toast('error',e instanceof Error?e.message:'Unable to activate blood broadcast')});
}
export function useConfirmHospitalBloodResponse() {
  const qc=useQueryClient(); const toast=useUiStore(s=>s.toast);
  return useMutation({mutationFn:bloodBroadcastService.confirmResponse,onSuccess:()=>{toast('success','Donor response confirmed');void qc.invalidateQueries({queryKey:['hospital-blood-broadcast-responses']});void qc.invalidateQueries({queryKey:['hospital-blood-broadcasts']});},onError:e=>toast('error',e instanceof Error?e.message:'Unable to confirm donor')});
}
export function useDeclineHospitalBloodResponse() {
  const qc=useQueryClient(); const toast=useUiStore(s=>s.toast);
  return useMutation({mutationFn:bloodBroadcastService.declineResponse,onSuccess:()=>{toast('success','Donor response declined');void qc.invalidateQueries({queryKey:['hospital-blood-broadcast-responses']});void qc.invalidateQueries({queryKey:['hospital-blood-broadcasts']});},onError:e=>toast('error',e instanceof Error?e.message:'Unable to decline donor')});
}
export function useCloseHospitalBloodBroadcast() {
  const qc=useQueryClient(); const toast=useUiStore(s=>s.toast);
  return useMutation({mutationFn:bloodBroadcastService.closeBroadcast,onSuccess:()=>{toast('success','Blood broadcast closed');void qc.invalidateQueries({queryKey:['hospital-blood-broadcasts']});},onError:e=>toast('error',e instanceof Error?e.message:'Unable to close broadcast')});
}
