import { supabase } from'@/lib/supabase';
import { FhirObservation } from'@/types/fhir.types';
import { ApiError } from'@/lib/api';

export const fhirService = {
 /**
 * Pushes a FHIR resource to the fhir-gateway edge function.
 */
  async pushResource(resource: unknown): Promise<{ success: boolean; message: string }> {
    const res = await supabase.functions.invoke<{ success: boolean; message: string; error?: string }>('fhir-gateway', {
      // @ts-expect-error supabase body type accepts unknown
      body: resource
    });

    if (res.error) {
      console.error('FHIR Gateway Error:', res.error);
      throw new ApiError('FHIR_SYNC_FAILED', 'Failed to sync data with the FHIR Gateway.');
    }

    if (res.data?.error) {
      throw new ApiError('FHIR_VALIDATION_ERROR', res.data.error);
    }

    if (!res.data) {
        throw new ApiError('FHIR_SYNC_FAILED', 'No data returned');
    }

    return res.data;
 },

 /**
 * Helper method to simulate a wearable device pushing heart rate data.
 */
 async syncWearableHeartRate(bpm: number, patientId: string) {
 const observation: FhirObservation = {
 resourceType:'Observation',
 status:'final',
 category: [{
 coding: [{
 system:'http://terminology.hl7.org/CodeSystem/observation-category',
 code:'vital-signs',
 display:'Vital Signs'
 }]
 }],
 code: {
 coding: [{
 system:'http://loinc.org',
 code:'8867-4',
 display:'Heart rate'
 }],
 text:'Heart rate'
 },
 subject: {
 reference: `Patient/${patientId}`
 },
 effectiveDateTime: new Date().toISOString(),
 valueQuantity: {
 value: bpm,
 unit:'beats/minute',
 system:'http://unitsofmeasure.org',
 code:'/min'
 }
 };

 return this.pushResource(observation);
 }
};
