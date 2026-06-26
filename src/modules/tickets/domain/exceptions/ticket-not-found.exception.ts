import { NotFoundException } from '@nestjs/common';

export class TicketNotFoundException extends NotFoundException {
  constructor(id?: string) {
    super(id ? `Ticket non trouvé : ${id}` : 'Ticket non trouvé.');
  }
}
