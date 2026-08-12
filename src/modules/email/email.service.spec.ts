import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;

  beforeAll(() => {
    service = new EmailService();
  });

  it('fallbackTemplate reste générique sans injecter les données utilisateur', () => {
    const html = service.fallbackTemplate('ticketAssigned');
    expect(html).toContain('ticketAssigned');
    expect(html).not.toContain('Données');
  });

  it('fallbackTemplate assainit le nom du template', () => {
    const html = service.fallbackTemplate('sla<Breach');
    expect(html).toContain('slaBreach');
  });
});
