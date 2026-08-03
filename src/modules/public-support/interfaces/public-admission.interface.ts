import { CreateTicketInput } from '../../tickets/dto/ticket-service.interfaces';

export type PublicImpact = 'LOW' | 'MEDIUM' | 'HIGH';
export type PublicUrgency = 'LOW' | 'MEDIUM' | 'HIGH';

export interface PublicTicketDraft {
  readonly categoryId: string;
  readonly title: string;
  readonly description: string;
  readonly impact: PublicImpact;
  readonly urgency: PublicUrgency;
  readonly customerAccountNumber?: string;
  readonly serviceKey?: string;
}

export interface PublicAdmissionResult {
  readonly input: CreateTicketInput;
  readonly routeSource: 'CATEGORY' | 'SERVICE' | 'DEFAULT_TRIAGE';
}

export interface PublicRouteTarget {
  readonly departmentId: string;
  readonly assignedTeamId: string;
  readonly priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly severity?: 'S1' | 'S2' | 'S3' | 'S4';
}
