// FHIR R4 Resources

export interface FhirMeta {
 versionId?: string;
 lastUpdated?: string;
 source?: string;
}

export interface FhirIdentifier {
 use?:'usual' |'official' |'temp' |'secondary' |'old';
 system?: string;
 value: string;
}

export interface FhirCodeableConcept {
 coding: {
 system?: string;
 code?: string;
 display?: string;
 }[];
 text?: string;
}

export interface FhirQuantity {
 value: number;
 unit?: string;
 system?: string;
 code?: string;
}

export interface FhirReference {
 reference?: string;
 type?: string;
 identifier?: FhirIdentifier;
 display?: string;
}

export interface FhirPatient {
 resourceType:'Patient';
 id?: string;
 meta?: FhirMeta;
 identifier?: FhirIdentifier[];
 active?: boolean;
 name?: {
 use?: string;
 text?: string;
 family?: string;
 given?: string[];
 }[];
 telecom?: {
 system?: string;
 value?: string;
 use?: string;
 }[];
 gender?:'male' |'female' |'other' |'unknown';
 birthDate?: string;
}

export interface FhirObservation {
 resourceType:'Observation';
 id?: string;
 meta?: FhirMeta;
 identifier?: FhirIdentifier[];
 status:'registered' |'preliminary' |'final' |'amended' |'corrected' |'cancelled' |'entered-in-error' |'unknown';
 category?: FhirCodeableConcept[];
 code: FhirCodeableConcept;
 subject?: FhirReference;
 effectiveDateTime?: string;
 effectivePeriod?: {
 start?: string;
 end?: string;
 };
 valueQuantity?: FhirQuantity;
 valueCodeableConcept?: FhirCodeableConcept;
 valueString?: string;
 valueBoolean?: boolean;
 valueInteger?: number;
 device?: FhirReference;
}
