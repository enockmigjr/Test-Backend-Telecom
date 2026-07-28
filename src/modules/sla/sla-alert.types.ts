export type SlaTarget = 'FIRST_RESPONSE' | 'RESOLUTION';

export interface SlaAlertTicket {
  readonly id: string;
  readonly ticketNumber: string;
  readonly title: string;
  readonly priority: string;
  readonly status: string;
  readonly severity: string;
  readonly categoryName: string | null;
  readonly departmentName: string | null;
  readonly departmentId: string;
  readonly assignedTo: string | null;
  readonly dueAt: Date;
  readonly assigneeEmail: string | null;
  readonly assigneeFirstName: string | null;
  readonly assigneeLastName: string | null;
}
