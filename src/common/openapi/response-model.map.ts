/**
 * ============================================================================
 * FICHIER : src/common/openapi/response-model.map.ts
 * RÔLE : Cartographie des modèles de réponses HTTP par identifiant d'opération NestJS.
 * EXPLICATION :
 * Ce module associe chaque méthode de contrôleur (`operationId`) au type de réponse OpenAPI correspondant :
 * 1. `item(schema)` : Retourne un objet unique enveloppé dans `data`.
 * 2. `array(schema)` : Retourne une liste non paginée d'objets dans `data`.
 * 3. `page(schema)` : Retourne une liste paginée avec métadonnées dans `data` et `meta`.
 * 4. `action` : Retourne un message de succès `{ success: true, message: "..." }`.
 * ============================================================================
 */

/** Type de format d'enveloppe OpenAPI. */
export type ResponseKind = 'item' | 'array' | 'page' | 'action' | 'prewrapped-array' | 'prewrapped-action';

/** Structure décrivant le modèle de réponse associé à une opération. */
export interface ResponseModel {
  readonly kind: ResponseKind;
  readonly schema?: string;
}

// Helpers de création d'objets ResponseModel
const item = (schema: string): ResponseModel => ({ kind: 'item', schema });
const array = (schema: string): ResponseModel => ({ kind: 'array', schema });
const page = (schema: string): ResponseModel => ({ kind: 'page', schema });
const action: ResponseModel = { kind: 'action' };

/**
 * Table de correspondance exhaustive associant les 60+ routes des contrôleurs REST à leur schéma Swagger.
 */
export const RELEASE_RESPONSE_MODELS: Readonly<Record<string, ResponseModel>> = {
  AuthController_login: item('LoginData'),
  AuthController_refresh: item('TokenPair'),
  AuthController_me: item('CurrentUser'),
  AuthController_changePassword: action,
  TicketsController_search: page('TicketListItem'),
  TicketsController_create: item('Ticket'),
  TicketsController_findOne: item('Ticket'),
  TicketsController_update: item('Ticket'),
  TicketsController_assign: item('Ticket'),
  TicketsController_reassign: item('Ticket'),
  TicketsController_escalate: item('Ticket'),
  TicketsController_start: item('Ticket'),
  TicketsController_resolve: item('Ticket'),
  TicketsController_close: item('Ticket'),
  TicketsController_reopen: item('Ticket'),
  TicketsController_pendingCustomer: item('Ticket'),
  TicketsController_pendingThirdParty: item('Ticket'),
  TicketsController_history: array('TicketHistory'),
  CommentsController_findAll: page('TicketComment'),
  CommentsController_create: item('TicketComment'),
  CommentsController_update: item('TicketComment'),
  InternalNotesController_findAll: page('InternalNote'),
  InternalNotesController_create: item('InternalNote'),
  InternalNotesController_update: action,
  AttachmentsController_upload: item('Attachment'),
  AttachmentsController_findAllForTicket: page('Attachment'),
  NotificationsController_findAll: page('Notification'),
  NotificationsController_unread: array('Notification'),
  NotificationsController_markRead: action,
  NotificationsController_markAllRead: action,
  DashboardController_overview: item('DashboardOverview'),
  DashboardController_ticketsByStatus: item('DashboardStatusSeries'),
  DashboardController_ticketsByPriority: item('DashboardPrioritySeries'),
  DashboardController_departments: item('DashboardDepartments'),
  DashboardController_slaCompliance: item('DashboardSlaCompliance'),
  DashboardController_workload: item('DashboardWorkload'),
  DashboardController_resolutionTime: item('DashboardResolutionTime'),
  UsersController_findAll: page('User'),
  UsersController_findOne: item('User'),
  UsersController_me: item('User'),
  UsersController_create: item('CreatedUser'),
  UsersController_update: item('User'),
  UsersController_activate: action,
  UsersController_deactivate: action,
  ExternalDeliveriesAdminController_list: page('ExternalDeliveryListItemDto'),
  ExternalDeliveriesAdminController_findOne: item('ExternalDeliveryListItemDto'),
  ExternalRequestersController_list: page('ExternalRequesterListItemDto'),
  ExternalRequestersController_detail: item('ExternalRequesterDetailDto'),
  DepartmentsController_findAll: array('Department'),
  DepartmentsController_findOne: item('Department'),
  DepartmentsController_create: item('Department'),
  DepartmentsController_update: item('Department'),
  CategoriesController_findAll: array('Category'),
  CategoriesController_findOne: item('Category'),
  CategoriesController_create: item('Category'),
  CategoriesController_update: item('Category'),
  CategoriesController_remove: action,
  SlaPoliciesController_findAll: array('SlaPolicy'),
  SlaPoliciesController_findOne: item('SlaPolicy'),
  SlaPoliciesController_create: item('SlaPolicy'),
  SlaPoliciesController_update: item('SlaPolicy'),
  AuditLogsController_search: page('AuditLog'),
  AuditLogsController_findOne: item('AuditLog'),
  ReportsController_listReports: page('Report'),
  ReportsController_getReport: item('Report'),
  ReportsController_getTicketReport: item('TicketReport'),
  ReportsController_slaReport: item('SlaReport'),
  ReportsController_ticketReport: item('ReportJob'),
  ReportsController_slaReportAsync: item('ReportJob'),
  ReportsController_weeklyReportAsync: item('ReportJob'),
  SettingsController_getAll: { kind: 'prewrapped-array', schema: 'Setting' },
  SettingsController_update: { kind: 'prewrapped-action' },
};
