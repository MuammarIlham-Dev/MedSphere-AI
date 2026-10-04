import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { hospitalBloodService } from '@/services/hospitalBlood.service';
import { useUiStore } from '@/stores/uiStore';

const inv=(qc:ReturnType<typeof useQueryClient>)=>{
  void qc.invalidateQueries({queryKey:['hospital-blood-requests']});
  void qc.invalidateQueries({queryKey:['blood-bank-hospital-requests']});
  void qc.invalidateQueries({queryKey:['blood-inventory']});
  void qc.invalidateQueries({queryKey:['blood-requests']});
};
export const useHospitalBloodRequests=(hospitalId?:string)=>useQuery({
  queryKey:['hospital-blood-requests',hospitalId],queryFn:()=>hospitalBloodService.requests(hospitalId!),enabled:!!hospitalId,refetchInterval:30000
});
export const useCreateHospitalBloodRequest=(hospitalId?:string)=>{
  const qc=useQueryClient(),toast=useUiStore(s=>s.toast);
  return useMutation({mutationFn:(v:{patientName:string;bloodGroup:any;units:number;urgency:any;neededBy?:string;notes?:string})=>hospitalBloodService.create(hospitalId!,v),
    onSuccess:()=>{inv(qc);toast('success','Blood requisition sent to the network')},onError:(e:Error)=>toast('error',e.message)});
};
export const useCancelHospitalBloodRequest=()=>{
  const qc=useQueryClient(),toast=useUiStore(s=>s.toast);
  return useMutation({mutationFn:hospitalBloodService.cancel,onSuccess:()=>{inv(qc);toast('success','Blood requisition cancelled')},onError:(e:Error)=>toast('error',e.message)});
};
export const useBloodBankHospitalRequests=(bankId?:string)=>useQuery({
  queryKey:['blood-bank-hospital-requests',bankId],queryFn:()=>hospitalBloodService.bankRequests(bankId!),enabled:!!bankId,refetchInterval:20000
});
export const useFulfillHospitalBloodRequest=(bankId?:string)=>{
  const qc=useQueryClient(),toast=useUiStore(s=>s.toast);
  return useMutation({mutationFn:({requestId,units}:{requestId:string;units:number})=>hospitalBloodService.fulfill(requestId,bankId!,units),
    onSuccess:()=>{inv(qc);toast('success','Hospital blood request fulfilled')},onError:(e:Error)=>toast('error',e.message)});
};
