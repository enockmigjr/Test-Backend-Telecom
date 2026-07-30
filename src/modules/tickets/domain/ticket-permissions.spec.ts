/**
 * ============================================================================
 * FICHIER : src/modules/tickets/domain/ticket-permissions.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant ticket-permissions.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de ticket-permissions.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { ForbiddenException } from '@nestjs/common';
import { JwtPayload } from '../../auth/interfaces/jwt-payload.interface';
import { TicketPermissionData, TicketPermissions } from './ticket-permissions';

const creator: JwtPayload = {
  sub: 'creator-001',
  email: 'creator@telecom.local',
  role: 'CUSTOMER_SERVICE_AGENT',
  departmentId: 'dept-001',
  mustChangePassword: false,
  jti: 'jti-001',
};
const ticket: TicketPermissionData = {
  id: 'ticket-001',
  createdBy: creator.sub,
  openedByUserId: creator.sub,
  assignedTo: 'assignee-001',
  assignedTeamId: 'dept-002',
  departmentId: 'dept-001',
  status: 'NEW',
  closedAt: null,
};

describe('TicketPermissions - edition createur', () => {
  const permissions = new TicketPermissions();

  /** Test : autorise le createur a modifier titre, description et categorie tant que le ticket est NEW */

  it('autorise le createur a modifier titre, description et categorie tant que le ticket est NEW', () => {
    expect(() =>
      permissions.checkCanUpdateFields(ticket, creator, ['title', 'description', 'categoryId']),
    ).not.toThrow();
  });

  /** Test : refuse le createur non assigne apres la sortie du statut NEW */

  it('refuse le createur non assigne apres la sortie du statut NEW', () => {
    expect(() => permissions.checkCanUpdateFields({ ...ticket, status: 'ASSIGNED' }, creator, ['title'])).toThrow(
      ForbiddenException,
    );
  });

  /** Test : conserve le droit de modification de l assigne */

  it('conserve le droit de modification de l assigne', () => {
    const assignee = { ...creator, sub: 'assignee-001' };
    expect(() =>
      permissions.checkCanUpdateFields({ ...ticket, status: 'IN_PROGRESS' }, assignee, ['description']),
    ).not.toThrow();
  });

  it('autorise un ouvreur canonique lorsque createdBy est absent', () => {
    expect(() =>
      permissions.checkCanUpdateFields({ ...ticket, createdBy: null, openedByUserId: creator.sub }, creator, ['title']),
    ).not.toThrow();
  });

  it('conserve le fallback createdBy pour un ticket legacy', () => {
    expect(() =>
      permissions.checkCanUpdateFields({ ...ticket, openedByUserId: undefined }, creator, ['categoryId']),
    ).not.toThrow();
  });

  it('refuse le createdBy legacy lorsque openedByUserId désigne un autre utilisateur', () => {
    expect(() =>
      permissions.checkCanUpdateFields({ ...ticket, openedByUserId: 'other-user' }, creator, ['title']),
    ).toThrow(ForbiddenException);
  });

  it('autorise la réouverture par l ouvreur canonique Customer Service', () => {
    expect(() =>
      permissions.checkCanReopen(
        { ...ticket, createdBy: null, openedByUserId: creator.sub, status: 'CLOSED', closedAt: new Date() },
        creator,
      ),
    ).not.toThrow();
  });
});
