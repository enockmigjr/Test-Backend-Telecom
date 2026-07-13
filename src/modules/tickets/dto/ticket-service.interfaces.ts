/**
 * Interfaces nommées pour les méthodes de TicketsService.
 * Remplacent les DTOs inline anonymes dans les signatures de service.
 */

export interface CreateTicketInput {
  title: string;
  description: string;
  priority: string;
  severity: string;
  categoryId: string;
  departmentId: string;
  assignedTeamId: string;
  customerAccountNumber?: string;
  customerName?: string;
  customerContact?: string;
  tags?: string;
}

export interface UpdateTicketInput {
  title?: string;
  description?: string;
  priority?: string;
  severity?: string;
  categoryId?: string;
  tags?: string;
}
