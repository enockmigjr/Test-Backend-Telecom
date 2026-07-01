import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as argon2 from 'argon2';
import { generateUuid } from '../../common/helpers/uuidv7.helper';
import * as schema from '../schemas';

const DATABASE_URL =
  process.env['DATABASE_URL'] || 'postgresql://telecom:telecom_secret@localhost:5432/telecom_tickets';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function hoursAgo(n: number): Date {
  return new Date(Date.now() - n * 60 * 60 * 1000);
}

async function seed() {
  const client = postgres(DATABASE_URL);
  const db = drizzle(client, { schema });

  console.log('🌱 Démarrage du seed complet...\n');

  console.log('🧹 Nettoyage des anciennes données...');
  await db.delete(schema.auditLogs);
  await db.delete(schema.notifications);
  await db.delete(schema.attachments);
  await db.delete(schema.ticketComments);
  await db.delete(schema.ticketInternalNotes);
  await db.delete(schema.ticketHistory);
  await db.delete(schema.ticketAssignments);
  await db.delete(schema.tickets);
  await db.delete(schema.refreshTokens);
  await db.delete(schema.users);
  await db.delete(schema.departments);
  await db.delete(schema.slaPolicies);
  console.log('🧹 Nettoyage terminé.');

  // ─── Séquence ticket_number ──────────────────────────────────────
  await client`DROP SEQUENCE IF EXISTS ticket_number_seq`;
  await client`CREATE SEQUENCE ticket_number_seq START 1 INCREMENT 1`;

  // ─── Départements ────────────────────────────────────────────────
  const deptData = [
    { name: 'Administration', description: 'Équipe administrative et direction' },
    { name: 'Customer Care', description: 'Service client — première ligne de support' },
    { name: 'NOC', description: 'Network Operations Center — Supervision Réseau 24/7' },
    { name: 'Billing', description: 'Service facturation et litiges financiers' },
    { name: 'Technical Support', description: 'Support technique avancé niveau 2/3' },
    { name: 'Field Operations', description: 'Opérations terrain et interventions physiques' },
  ];

  const deptIds: Record<string, string> = {};
  for (const d of deptData) {
    const id = generateUuid();
    deptIds[d.name] = id;
    await db.insert(schema.departments).values({ id, name: d.name, description: d.description }).onConflictDoNothing();
  }
  console.log('✅ Départements créés');

  // ─── Politiques SLA ──────────────────────────────────────────────
  type SlaCategory = 'NETWORK' | 'BILLING' | 'TECHNICAL' | 'HARDWARE' | 'SOFTWARE' | 'OTHER';
  type SlaPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  const slaData: Array<{
    category: SlaCategory;
    priority: SlaPriority;
    firstResponseMinutes: number;
    resolutionMinutes: number;
  }> = [
    { category: 'NETWORK', priority: 'CRITICAL', firstResponseMinutes: 15, resolutionMinutes: 120 },
    { category: 'NETWORK', priority: 'HIGH', firstResponseMinutes: 30, resolutionMinutes: 240 },
    { category: 'NETWORK', priority: 'MEDIUM', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { category: 'NETWORK', priority: 'LOW', firstResponseMinutes: 120, resolutionMinutes: 1440 },
    { category: 'BILLING', priority: 'CRITICAL', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { category: 'BILLING', priority: 'HIGH', firstResponseMinutes: 120, resolutionMinutes: 960 },
    { category: 'BILLING', priority: 'MEDIUM', firstResponseMinutes: 240, resolutionMinutes: 2880 },
    { category: 'BILLING', priority: 'LOW', firstResponseMinutes: 480, resolutionMinutes: 4320 },
    { category: 'TECHNICAL', priority: 'CRITICAL', firstResponseMinutes: 30, resolutionMinutes: 240 },
    { category: 'TECHNICAL', priority: 'HIGH', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { category: 'TECHNICAL', priority: 'MEDIUM', firstResponseMinutes: 120, resolutionMinutes: 1440 },
    { category: 'TECHNICAL', priority: 'LOW', firstResponseMinutes: 240, resolutionMinutes: 2880 },
    { category: 'HARDWARE', priority: 'CRITICAL', firstResponseMinutes: 30, resolutionMinutes: 360 },
    { category: 'HARDWARE', priority: 'HIGH', firstResponseMinutes: 60, resolutionMinutes: 720 },
    { category: 'HARDWARE', priority: 'MEDIUM', firstResponseMinutes: 120, resolutionMinutes: 2160 },
    { category: 'HARDWARE', priority: 'LOW', firstResponseMinutes: 240, resolutionMinutes: 4320 },
    { category: 'SOFTWARE', priority: 'CRITICAL', firstResponseMinutes: 20, resolutionMinutes: 180 },
    { category: 'SOFTWARE', priority: 'HIGH', firstResponseMinutes: 45, resolutionMinutes: 360 },
    { category: 'SOFTWARE', priority: 'MEDIUM', firstResponseMinutes: 90, resolutionMinutes: 960 },
    { category: 'SOFTWARE', priority: 'LOW', firstResponseMinutes: 180, resolutionMinutes: 2880 },
    { category: 'OTHER', priority: 'CRITICAL', firstResponseMinutes: 60, resolutionMinutes: 480 },
    { category: 'OTHER', priority: 'HIGH', firstResponseMinutes: 120, resolutionMinutes: 960 },
    { category: 'OTHER', priority: 'MEDIUM', firstResponseMinutes: 240, resolutionMinutes: 2880 },
    { category: 'OTHER', priority: 'LOW', firstResponseMinutes: 480, resolutionMinutes: 5760 },
  ];

  const slaIds: Record<string, string> = {};
  for (const sla of slaData) {
    const id = generateUuid();
    slaIds[`${sla.category}_${sla.priority}`] = id;
    await db
      .insert(schema.slaPolicies)
      .values({ id, ...sla })
      .onConflictDoNothing();
  }
  console.log('✅ Politiques SLA créées (24 entrées)');

  // ─── Mots de passe hashés ────────────────────────────────────────
  const [agentHash, adminHash, supervisorHash] = await Promise.all([
    argon2.hash('Agent@1234', { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }),
    argon2.hash('Admin@1234', { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }),
    argon2.hash('Super@1234', { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 }),
  ]);

  // ─── Utilisateurs ────────────────────────────────────────────────
  type UserRole =
    | 'ADMINISTRATOR'
    | 'SUPERVISOR'
    | 'CUSTOMER_SERVICE_AGENT'
    | 'NOC_ENGINEER'
    | 'BILLING_AGENT'
    | 'TECHNICAL_SUPPORT_ENGINEER'
    | 'FIELD_TECHNICIAN';

  const userData: Array<{
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    department: string;
    hash: string;
  }> = [
    {
      email: 'admin@telecom.local',
      firstName: 'Admin',
      lastName: 'Système',
      role: 'ADMINISTRATOR',
      department: 'Administration',
      hash: adminHash,
    },
    {
      email: 'supervisor@telecom.local',
      firstName: 'Sophie',
      lastName: 'Laurent',
      role: 'SUPERVISOR',
      department: 'Customer Care',
      hash: supervisorHash,
    },
    {
      email: 'supervisor-noc@telecom.local',
      firstName: 'Marc',
      lastName: 'Bernard',
      role: 'SUPERVISOR',
      department: 'NOC',
      hash: supervisorHash,
    },
    {
      email: 'agent-cc1@telecom.local',
      firstName: 'Alice',
      lastName: 'Dupont',
      role: 'CUSTOMER_SERVICE_AGENT',
      department: 'Customer Care',
      hash: agentHash,
    },
    {
      email: 'agent-cc2@telecom.local',
      firstName: 'Thomas',
      lastName: 'Lebrun',
      role: 'CUSTOMER_SERVICE_AGENT',
      department: 'Customer Care',
      hash: agentHash,
    },
    {
      email: 'noc1@telecom.local',
      firstName: 'Bob',
      lastName: 'Martin',
      role: 'NOC_ENGINEER',
      department: 'NOC',
      hash: agentHash,
    },
    {
      email: 'noc2@telecom.local',
      firstName: 'Julie',
      lastName: 'Simon',
      role: 'NOC_ENGINEER',
      department: 'NOC',
      hash: agentHash,
    },
    {
      email: 'billing1@telecom.local',
      firstName: 'Claire',
      lastName: 'Petit',
      role: 'BILLING_AGENT',
      department: 'Billing',
      hash: agentHash,
    },
    {
      email: 'billing2@telecom.local',
      firstName: 'Luc',
      lastName: 'Garnier',
      role: 'BILLING_AGENT',
      department: 'Billing',
      hash: agentHash,
    },
    {
      email: 'tech1@telecom.local',
      firstName: 'David',
      lastName: 'Roux',
      role: 'TECHNICAL_SUPPORT_ENGINEER',
      department: 'Technical Support',
      hash: agentHash,
    },
    {
      email: 'tech2@telecom.local',
      firstName: 'Nina',
      lastName: 'Morel',
      role: 'TECHNICAL_SUPPORT_ENGINEER',
      department: 'Technical Support',
      hash: agentHash,
    },
    {
      email: 'agent@telecom.local',
      firstName: 'Test',
      lastName: 'Agent',
      role: 'TECHNICAL_SUPPORT_ENGINEER',
      department: 'Technical Support',
      hash: agentHash,
    },
    {
      email: 'field1@telecom.local',
      firstName: 'Emma',
      lastName: 'Moreau',
      role: 'FIELD_TECHNICIAN',
      department: 'Field Operations',
      hash: agentHash,
    },
    {
      email: 'field2@telecom.local',
      firstName: 'Kevin',
      lastName: 'Blanc',
      role: 'FIELD_TECHNICIAN',
      department: 'Field Operations',
      hash: agentHash,
    },
  ];

  const userIds: Record<string, string> = {};
  for (const u of userData) {
    const id = generateUuid();
    userIds[u.email] = id;
    await db
      .insert(schema.users)
      .values({
        id,
        email: u.email,
        passwordHash: u.hash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        departmentId: deptIds[u.department],
      })
      .onConflictDoNothing();
  }
  console.log(`✅ Utilisateurs créés (${userData.length} utilisateurs)`);

  // ─── Tickets ─────────────────────────────────────────────────────
  type TicketStatus = 'NEW' | 'ASSIGNED' | 'IN_PROGRESS' | 'PENDING_CUSTOMER' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  type TicketSeverity = 'S1' | 'S2' | 'S3' | 'S4';
  type TicketCategory = 'NETWORK' | 'BILLING' | 'TECHNICAL' | 'HARDWARE' | 'SOFTWARE' | 'OTHER';

  interface TicketSeed {
    title: string;
    description: string;
    status: TicketStatus;
    priority: TicketPriority;
    severity: TicketSeverity;
    category: TicketCategory;
    departmentKey: string;
    assignedTeamKey: string;
    createdByEmail: string;
    assignedToEmail?: string;
    customerName?: string;
    customerAccount?: string;
    daysCreatedAgo: number;
    resolved?: boolean;
    closed?: boolean;
    slaBreached?: boolean;
  }

  const ticketsData: TicketSeed[] = [
    {
      title: 'Panne réseau totale — Zone Industrielle Est',
      description:
        'Coupure complète du réseau fibre pour 3 entreprises clientes dans la zone industrielle Est. Impact: environ 150 utilisateurs hors service.',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      severity: 'S1',
      category: 'NETWORK',
      departmentKey: 'NOC',
      assignedTeamKey: 'NOC',
      createdByEmail: 'agent-cc1@telecom.local',
      assignedToEmail: 'noc1@telecom.local',
      customerName: 'ZI Est Industries',
      customerAccount: 'ACC-001-ZIE',
      daysCreatedAgo: 1,
      slaBreached: true,
    },
    {
      title: 'Facture incorrecte — Double facturation abonnement',
      description:
        'Le client signale une double facturation sur sa facture du mois de juin. Montant en litige: 89,90€.',
      status: 'ASSIGNED',
      priority: 'HIGH',
      severity: 'S2',
      category: 'BILLING',
      departmentKey: 'Billing',
      assignedTeamKey: 'Billing',
      createdByEmail: 'agent-cc2@telecom.local',
      assignedToEmail: 'billing1@telecom.local',
      customerName: 'Mme Fontaine Sylvie',
      customerAccount: 'ACC-002-FSY',
      daysCreatedAgo: 2,
    },
    {
      title: 'Dégradation performance ADSL — -50% débit',
      description:
        'Client signale une chute de débit depuis 72h. Débit mesuré: 4 Mbps au lieu de 8 Mbps habituels. Diagnostics niveau 1 échoués.',
      status: 'IN_PROGRESS',
      priority: 'MEDIUM',
      severity: 'S2',
      category: 'TECHNICAL',
      departmentKey: 'Technical Support',
      assignedTeamKey: 'Technical Support',
      createdByEmail: 'agent-cc1@telecom.local',
      assignedToEmail: 'tech1@telecom.local',
      customerName: 'Dupuis André',
      customerAccount: 'ACC-003-DAI',
      daysCreatedAgo: 3,
    },
    {
      title: 'Routeur défaillant — Remplacement requis',
      description:
        'Routeur industriel client non accessible en remote. Panne matérielle confirmée. Nécessite intervention physique.',
      status: 'ASSIGNED',
      priority: 'HIGH',
      severity: 'S2',
      category: 'HARDWARE',
      departmentKey: 'Field Operations',
      assignedTeamKey: 'Field Operations',
      createdByEmail: 'noc2@telecom.local',
      assignedToEmail: 'field1@telecom.local',
      customerName: 'Boucherie Centrale',
      customerAccount: 'ACC-004-BCT',
      daysCreatedAgo: 1,
    },
    {
      title: 'Portail client inaccessible — Erreur 502',
      description:
        'Le portail de gestion client retourne une erreur 502 Bad Gateway depuis 2 heures. Impact: environ 300 clients.',
      status: 'NEW',
      priority: 'CRITICAL',
      severity: 'S1',
      category: 'SOFTWARE',
      departmentKey: 'Technical Support',
      assignedTeamKey: 'Technical Support',
      createdByEmail: 'noc1@telecom.local',
      daysCreatedAgo: 0,
    },
    {
      title: 'Demande résiliation abonnement Pro',
      description:
        'Client souhaite résilier son abonnement Pro au 31/07. Demande de confirmation du processus et remboursement au prorata.',
      status: 'RESOLVED',
      priority: 'LOW',
      severity: 'S4',
      category: 'BILLING',
      departmentKey: 'Billing',
      assignedTeamKey: 'Billing',
      createdByEmail: 'agent-cc2@telecom.local',
      assignedToEmail: 'billing2@telecom.local',
      customerName: 'SARL Leclerc Père & Fils',
      customerAccount: 'ACC-005-LPF',
      daysCreatedAgo: 5,
      resolved: true,
    },
    {
      title: 'Coupure fibre optique — Travaux voirie',
      description:
        'Suite aux travaux de voirie rue Gambetta, la fibre optique a été coupée accidentellement. Intervention terrain urgente requise.',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      severity: 'S1',
      category: 'NETWORK',
      departmentKey: 'Field Operations',
      assignedTeamKey: 'Field Operations',
      createdByEmail: 'noc2@telecom.local',
      assignedToEmail: 'field2@telecom.local',
      customerName: 'Quartier Gambetta',
      daysCreatedAgo: 0,
    },
    {
      title: 'Demande ajout ligne téléphonique',
      description: "Client demande l'ajout d'une 3ème ligne téléphonique pro à son contrat existant.",
      status: 'CLOSED',
      priority: 'LOW',
      severity: 'S4',
      category: 'OTHER',
      departmentKey: 'Customer Care',
      assignedTeamKey: 'Customer Care',
      createdByEmail: 'agent-cc1@telecom.local',
      assignedToEmail: 'agent-cc2@telecom.local',
      customerName: 'Cabinet Médical Dr Renard',
      customerAccount: 'ACC-006-CMR',
      daysCreatedAgo: 7,
      resolved: true,
      closed: true,
    },
    {
      title: 'Perturbation voix sur IP — Coupures appels',
      description:
        'Les appels VoIP présentent des coupures toutes les 2-3 minutes. Problème survenu après mise à jour firmware du routeur la semaine dernière.',
      status: 'PENDING_CUSTOMER',
      priority: 'MEDIUM',
      severity: 'S3',
      category: 'TECHNICAL',
      departmentKey: 'Technical Support',
      assignedTeamKey: 'Technical Support',
      createdByEmail: 'agent-cc1@telecom.local',
      assignedToEmail: 'tech2@telecom.local',
      customerName: 'Société Générale de Travaux',
      customerAccount: 'ACC-007-SGT',
      daysCreatedAgo: 4,
    },
    {
      title: 'Alerte dépassement quota — 90% utilisé',
      description:
        'Alerte automatique : le client a atteint 90% de son quota data mensuel. Notification pro-active à envoyer.',
      status: 'RESOLVED',
      priority: 'LOW',
      severity: 'S4',
      category: 'BILLING',
      departmentKey: 'Billing',
      assignedTeamKey: 'Billing',
      createdByEmail: 'billing1@telecom.local',
      assignedToEmail: 'billing1@telecom.local',
      customerName: 'École Primaire Jules Ferry',
      customerAccount: 'ACC-008-EJF',
      daysCreatedAgo: 6,
      resolved: true,
    },
    {
      title: 'Interférence réseau mobile — Zone commerciale',
      description:
        'Signal 4G très dégradé (-80 dBm) dans toute la zone commerciale Nord. Rapport de 12 clients différents sur la même journée.',
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      severity: 'S2',
      category: 'NETWORK',
      departmentKey: 'NOC',
      assignedTeamKey: 'NOC',
      createdByEmail: 'noc1@telecom.local',
      assignedToEmail: 'noc2@telecom.local',
      daysCreatedAgo: 2,
      slaBreached: true,
    },
    {
      title: 'Mise à jour firmware échouée — Livebox v3',
      description:
        'Mise à jour automatique du firmware de la Livebox v3 échouée. Le boîtier est en mode recovery. Client inaccessible.',
      status: 'ASSIGNED',
      priority: 'MEDIUM',
      severity: 'S3',
      category: 'HARDWARE',
      departmentKey: 'Technical Support',
      assignedTeamKey: 'Technical Support',
      createdByEmail: 'agent-cc2@telecom.local',
      assignedToEmail: 'tech1@telecom.local',
      customerName: 'M. Gautier Pierre',
      customerAccount: 'ACC-009-GPI',
      daysCreatedAgo: 1,
    },
    {
      title: 'Fraude présumée — Appels internationaux non reconnus',
      description:
        'Client signale des appels vers destinations hors contrat sur sa facture. Montant: 340€. Demande de blocage immédiat et investigation.',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      severity: 'S1',
      category: 'BILLING',
      departmentKey: 'Billing',
      assignedTeamKey: 'Billing',
      createdByEmail: 'agent-cc1@telecom.local',
      assignedToEmail: 'billing2@telecom.local',
      customerName: 'Imprimerie Rapide SAS',
      customerAccount: 'ACC-010-IRS',
      daysCreatedAgo: 0,
    },
    {
      title: 'API intégration SMS — Timeout fréquents',
      description:
        "L'API SMS de notre plateforme retourne des timeouts à 30% des requêtes depuis 48h. Impact: applications clients.",
      status: 'NEW',
      priority: 'HIGH',
      severity: 'S2',
      category: 'SOFTWARE',
      departmentKey: 'Technical Support',
      assignedTeamKey: 'Technical Support',
      createdByEmail: 'tech2@telecom.local',
      daysCreatedAgo: 0,
    },
    {
      title: 'Antenne relais défaillante — Tour B47',
      description:
        "L'antenne relais B47 (secteur Nord-Ouest) indique des erreurs matérielles critiques sur la supervision. Couverture réduite de 40%.",
      status: 'ASSIGNED',
      priority: 'CRITICAL',
      severity: 'S1',
      category: 'HARDWARE',
      departmentKey: 'Field Operations',
      assignedTeamKey: 'Field Operations',
      createdByEmail: 'noc1@telecom.local',
      assignedToEmail: 'field1@telecom.local',
      daysCreatedAgo: 1,
    },
    {
      title: 'Problème facturation internationale — Itinérance',
      description:
        "Client en déplacement professionnel à l'étranger depuis 3 jours. Sa ligne est bloquée malgré l'option roaming activée.",
      status: 'RESOLVED',
      priority: 'HIGH',
      severity: 'S2',
      category: 'BILLING',
      departmentKey: 'Billing',
      assignedTeamKey: 'Billing',
      createdByEmail: 'agent-cc2@telecom.local',
      assignedToEmail: 'billing1@telecom.local',
      customerName: 'Mme Bertrand Isabelle',
      customerAccount: 'ACC-011-BIS',
      daysCreatedAgo: 4,
      resolved: true,
    },
    {
      title: 'Configuration VPN site-à-site — Nouvelle demande',
      description:
        "Nouveau client professionnel demande la mise en place d'un VPN IPSec site-à-site entre ses 2 agences.",
      status: 'ASSIGNED',
      priority: 'MEDIUM',
      severity: 'S3',
      category: 'TECHNICAL',
      departmentKey: 'Technical Support',
      assignedTeamKey: 'Technical Support',
      createdByEmail: 'agent-cc1@telecom.local',
      assignedToEmail: 'tech2@telecom.local',
      customerName: 'Finance Partners SA',
      customerAccount: 'ACC-012-FPS',
      daysCreatedAgo: 2,
    },
    {
      title: 'Câble sous-marin endommagé — Perte 20% capacité',
      description:
        'Rapport de surveillance: le câble sous-marin segment Med-02 présente une dégradation de signal. Perte de 20% de capacité transit.',
      status: 'IN_PROGRESS',
      priority: 'CRITICAL',
      severity: 'S1',
      category: 'NETWORK',
      departmentKey: 'NOC',
      assignedTeamKey: 'NOC',
      createdByEmail: 'noc2@telecom.local',
      assignedToEmail: 'noc1@telecom.local',
      daysCreatedAgo: 3,
      slaBreached: true,
    },
    {
      title: 'Demande numéro portabilité — Délai dépassé',
      description:
        "La portabilité du numéro n'a pas été effectuée dans le délai contractuel de 5 jours ouvrés. Client mécontent.",
      status: 'IN_PROGRESS',
      priority: 'HIGH',
      severity: 'S2',
      category: 'OTHER',
      departmentKey: 'Customer Care',
      assignedTeamKey: 'Customer Care',
      createdByEmail: 'agent-cc2@telecom.local',
      assignedToEmail: 'agent-cc1@telecom.local',
      customerName: 'Brasserie du Centre',
      customerAccount: 'ACC-013-BDC',
      daysCreatedAgo: 6,
      slaBreached: true,
    },
    {
      title: 'Spam SMS entrant — 200+ messages par jour',
      description:
        'Client reçoit plus de 200 SMS de spam par jour depuis 1 semaine. Demande de filtrage/blocage et investigation sur la source.',
      status: 'NEW',
      priority: 'MEDIUM',
      severity: 'S3',
      category: 'SOFTWARE',
      departmentKey: 'Technical Support',
      assignedTeamKey: 'Technical Support',
      createdByEmail: 'agent-cc1@telecom.local',
      customerName: 'M. Vasseur Antoine',
      customerAccount: 'ACC-014-VAT',
      daysCreatedAgo: 0,
    },
  ];

  const ticketIds: string[] = [];

  for (let i = 0; i < ticketsData.length; i++) {
    const t = ticketsData[i];
    const id = generateUuid();
    ticketIds.push(id);
    const slaKey = `${t.category}_${t.priority}`;
    const slaId = slaIds[slaKey] || Object.values(slaIds)[0];
    const createdByEmail = t.createdByEmail;
    const createdById = userIds[createdByEmail];
    const assignedToId = t.assignedToEmail ? userIds[t.assignedToEmail] : null;
    const ticketNumber = `TT-2026-${String(i + 1).padStart(6, '0')}`;
    const createdAt = daysAgo(t.daysCreatedAgo);
    const slaPolicy = slaData.find((s) => s.category === t.category && s.priority === t.priority);
    const firstResponseDueAt = new Date(createdAt.getTime() + (slaPolicy?.firstResponseMinutes ?? 60) * 60 * 1000);
    const resolutionDueAt = new Date(createdAt.getTime() + (slaPolicy?.resolutionMinutes ?? 480) * 60 * 1000);

    await db
      .insert(schema.tickets)
      .values({
        id,
        ticketNumber,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        severity: t.severity,
        category: t.category,
        slaPolicyId: slaId,
        customerName: t.customerName || null,
        customerAccountNumber: t.customerAccount || null,
        departmentId: deptIds[t.departmentKey],
        assignedTeamId: deptIds[t.assignedTeamKey],
        createdBy: createdById,
        assignedTo: assignedToId,
        firstResponseDueAt,
        resolutionDueAt,
        resolvedAt: t.resolved ? hoursAgo(2) : null,
        closedAt: t.closed ? hoursAgo(1) : null,
        slaBreached: t.slaBreached ?? false,
        firstResponseAt: t.status !== 'NEW' ? hoursAgo(t.daysCreatedAgo * 24 - 1) : null,
        tags: t.category === 'NETWORK' ? 'reseau,infrastructure' : t.category === 'BILLING' ? 'facturation' : null,
        createdAt,
        updatedAt: hoursAgo(Math.floor(Math.random() * 12)),
      })
      .onConflictDoNothing();
  }
  console.log(`✅ Tickets créés (${ticketsData.length} tickets)`);

  // ─── Ticket Assignments ──────────────────────────────────────────
  // Assignations pour les tickets qui ont un assigné
  const assignedTickets = ticketsData
    .map((t, i) => ({ ...t, id: ticketIds[i] }))
    .filter((t) => t.assignedToEmail && t.status !== 'NEW');

  for (const t of assignedTickets) {
    const supervisorEmail = t.departmentKey === 'NOC' ? 'supervisor-noc@telecom.local' : 'supervisor@telecom.local';
    await db
      .insert(schema.ticketAssignments)
      .values({
        id: generateUuid(),
        ticketId: t.id,
        fromUserId: null,
        toUserId: userIds[t.assignedToEmail!],
        fromDepartmentId: null,
        toDepartmentId: deptIds[t.departmentKey],
        assignedBy: userIds[supervisorEmail] || userIds['admin@telecom.local'],
        reason: 'Assignation initiale depuis le seed',
        createdAt: daysAgo(t.daysCreatedAgo - 0.5),
      })
      .onConflictDoNothing();
  }
  console.log(`✅ Assignations créées (${assignedTickets.length} entrées)`);

  // ─── Commentaires sur les tickets ────────────────────────────────
  const commentTemplates = [
    {
      text: 'Ticket reçu et enregistré. Nous analysons le problème et revenons vers vous dans les plus brefs délais.',
      role: 'CC',
    },
    {
      text: "Investigation en cours. Premiers éléments de diagnostic collectés. Le problème semble provenir de l'infrastructure de distribution.",
      role: 'TECH',
    },
    {
      text: 'Intervention planifiée pour demain matin. Équipe terrain mobilisée. Mise à jour après intervention.',
      role: 'TECH',
    },
    { text: 'Merci pour votre signalement. Nous traitons votre demande en priorité.', role: 'CC' },
    {
      text: 'Le problème a été identifié : défaillance du commutateur principal. Remplacement en cours.',
      role: 'TECH',
    },
    {
      text: 'Service rétabli. Surveillance active pendant les 24 prochaines heures pour confirmer la stabilité.',
      role: 'TECH',
    },
    {
      text: 'Remboursement validé pour la somme en litige. Crédit appliqué sur la prochaine facture sous 48h.',
      role: 'BILLING',
    },
    { text: 'Configuration mise à jour. Merci de tester et confirmer la résolution du problème.', role: 'TECH' },
  ];

  for (let i = 0; i < Math.min(12, ticketIds.length); i++) {
    const numComments = i < 4 ? 3 : i < 8 ? 2 : 1;
    for (let j = 0; j < numComments; j++) {
      const template = commentTemplates[(i + j) % commentTemplates.length];
      let authorId = userIds['agent-cc1@telecom.local'];
      if (template.role === 'TECH') authorId = userIds['tech1@telecom.local'];
      if (template.role === 'BILLING') authorId = userIds['billing1@telecom.local'];

      await db
        .insert(schema.ticketComments)
        .values({
          id: generateUuid(),
          ticketId: ticketIds[i],
          authorId,
          content: template.text,
          createdAt: hoursAgo((numComments - j) * 4 + i),
        })
        .onConflictDoNothing();
    }
  }
  console.log('✅ Commentaires créés (sur 12 tickets)');

  // ─── Notes internes ──────────────────────────────────────────────
  const noteTemplates = [
    "ESCALADE INTERNE: Confirmer avec l'équipe technique l'impact réseau avant de communiquer au client.",
    'Note supervisor: Priorité absolue — client stratégique (CA > 50K€/an). Tenir informé le directeur technique.',
    'Attention: Client déjà mécontent après incident similaire il y a 3 mois. Traitement soigné requis.',
    'Diagnostic niveau 2 requis. Contacter noc1@telecom.local pour coordination inter-équipes.',
    'SLA en risque — moins de 2h avant breach. Accélérer le traitement et notifier le supervisor.',
  ];

  for (let i = 0; i < Math.min(8, ticketIds.length); i++) {
    const supervisorId = userIds['supervisor@telecom.local'];
    await db
      .insert(schema.ticketInternalNotes)
      .values({
        id: generateUuid(),
        ticketId: ticketIds[i],
        authorId: supervisorId,
        content: noteTemplates[i % noteTemplates.length],
        createdAt: hoursAgo(i * 3 + 1),
      })
      .onConflictDoNothing();
  }
  console.log('✅ Notes internes créées (8 notes)');

  // ─── Notifications ───────────────────────────────────────────────
  type NotifType =
    | 'TICKET_ASSIGNED'
    | 'TICKET_ESCALATED'
    | 'TICKET_RESOLVED'
    | 'COMMENT_ADDED'
    | 'SLA_WARNING'
    | 'SLA_BREACHED';

  const notifData: Array<{
    userEmail: string;
    type: NotifType;
    title: string;
    message: string;
    ticketIdx: number;
    isRead: boolean;
  }> = [
    {
      userEmail: 'noc1@telecom.local',
      type: 'TICKET_ASSIGNED',
      title: 'Nouveau ticket assigné',
      message: 'Le ticket TT-2026-000001 vous a été assigné.',
      ticketIdx: 0,
      isRead: false,
    },
    {
      userEmail: 'billing1@telecom.local',
      type: 'TICKET_ASSIGNED',
      title: 'Nouveau ticket assigné',
      message: 'Le ticket TT-2026-000002 vous a été assigné.',
      ticketIdx: 1,
      isRead: false,
    },
    {
      userEmail: 'tech1@telecom.local',
      type: 'TICKET_ASSIGNED',
      title: 'Nouveau ticket assigné',
      message: 'Le ticket TT-2026-000003 vous a été assigné.',
      ticketIdx: 2,
      isRead: true,
    },
    {
      userEmail: 'noc1@telecom.local',
      type: 'SLA_BREACHED',
      title: '⚠️ SLA Dépassé — TT-2026-000001',
      message: 'Le SLA du ticket TT-2026-000001 a été dépassé.',
      ticketIdx: 0,
      isRead: false,
    },
    {
      userEmail: 'supervisor@telecom.local',
      type: 'SLA_BREACHED',
      title: '🔴 Breach SLA détecté',
      message: 'Le ticket TT-2026-000001 a dépassé son SLA de résolution.',
      ticketIdx: 0,
      isRead: false,
    },
    {
      userEmail: 'tech2@telecom.local',
      type: 'TICKET_ASSIGNED',
      title: 'Ticket escaladé',
      message: 'Le ticket TT-2026-000009 a été escaladé vers vous.',
      ticketIdx: 8,
      isRead: false,
    },
    {
      userEmail: 'billing2@telecom.local',
      type: 'TICKET_ESCALATED',
      title: 'Ticket escaladé',
      message: 'Le ticket fraude TT-2026-000013 a été escaladé vers vous.',
      ticketIdx: 12,
      isRead: false,
    },
    {
      userEmail: 'agent-cc2@telecom.local',
      type: 'TICKET_RESOLVED',
      title: 'Ticket résolu',
      message: 'Le ticket TT-2026-000006 a été résolu.',
      ticketIdx: 5,
      isRead: true,
    },
    {
      userEmail: 'noc2@telecom.local',
      type: 'SLA_WARNING',
      title: '⏰ SLA Warning',
      message: "Moins de 30 minutes avant l'échéance SLA du ticket TT-2026-000011.",
      ticketIdx: 10,
      isRead: false,
    },
    {
      userEmail: 'supervisor-noc@telecom.local',
      type: 'SLA_BREACHED',
      title: '🔴 Breach SLA — NOC',
      message: 'Le ticket TT-2026-000018 a dépassé son SLA.',
      ticketIdx: 17,
      isRead: false,
    },
  ];

  for (const n of notifData) {
    const userId = userIds[n.userEmail];
    const ticketId = ticketIds[n.ticketIdx] ?? ticketIds[0];
    if (!userId) continue;
    await db
      .insert(schema.notifications)
      .values({
        id: generateUuid(),
        userId,
        type: n.type,
        title: n.title,
        message: n.message,
        referenceType: 'ticket',
        referenceId: ticketId,
        isRead: n.isRead,
        readAt: n.isRead ? hoursAgo(1) : null,
        createdAt: hoursAgo(Math.floor(Math.random() * 48)),
      })
      .onConflictDoNothing();
  }
  console.log(`✅ Notifications créées (${notifData.length} notifications)`);

  // ─── Audit Logs ──────────────────────────────────────────────────
  const auditEntries = [
    {
      userId: userIds['admin@telecom.local'],
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: userIds['noc1@telecom.local'],
      newValue: { email: 'noc1@telecom.local', role: 'NOC_ENGINEER' },
    },
    {
      userId: userIds['admin@telecom.local'],
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: userIds['tech1@telecom.local'],
      newValue: { email: 'tech1@telecom.local', role: 'TECHNICAL_SUPPORT_ENGINEER' },
    },
    {
      userId: userIds['agent-cc1@telecom.local'],
      action: 'TICKET_CREATED',
      entityType: 'ticket',
      entityId: ticketIds[0],
      newValue: { ticketNumber: 'TT-2026-000001', priority: 'CRITICAL' },
    },
    {
      userId: userIds['agent-cc2@telecom.local'],
      action: 'TICKET_CREATED',
      entityType: 'ticket',
      entityId: ticketIds[1],
      newValue: { ticketNumber: 'TT-2026-000002', priority: 'HIGH' },
    },
    {
      userId: userIds['supervisor@telecom.local'],
      action: 'TICKET_ASSIGNED',
      entityType: 'ticket',
      entityId: ticketIds[0],
      newValue: { assignedTo: 'noc1@telecom.local' },
    },
    {
      userId: userIds['supervisor@telecom.local'],
      action: 'TICKET_ASSIGNED',
      entityType: 'ticket',
      entityId: ticketIds[1],
      newValue: { assignedTo: 'billing1@telecom.local' },
    },
    {
      userId: userIds['billing1@telecom.local'],
      action: 'STATUS_CHANGED',
      entityType: 'ticket',
      entityId: ticketIds[5],
      oldValue: { status: 'IN_PROGRESS' },
      newValue: { status: 'RESOLVED' },
    },
    {
      userId: userIds['supervisor@telecom.local'],
      action: 'STATUS_CHANGED',
      entityType: 'ticket',
      entityId: ticketIds[7],
      oldValue: { status: 'RESOLVED' },
      newValue: { status: 'CLOSED' },
    },
    {
      userId: userIds['admin@telecom.local'],
      action: 'USER_DEACTIVATED',
      entityType: 'user',
      entityId: userIds['field2@telecom.local'],
      oldValue: { isActive: true },
      newValue: { isActive: false },
    },
    {
      userId: userIds['admin@telecom.local'],
      action: 'USER_ACTIVATED',
      entityType: 'user',
      entityId: userIds['field2@telecom.local'],
      oldValue: { isActive: false },
      newValue: { isActive: true },
    },
  ];

  for (const entry of auditEntries) {
    await db
      .insert(schema.auditLogs)
      .values({
        id: generateUuid(),
        userId: entry.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        oldValue: (entry as { oldValue?: unknown }).oldValue ?? null,
        newValue: entry.newValue ?? null,
        ipAddress: '127.0.0.1',
        userAgent: 'seed-script/1.0',
        createdAt: hoursAgo(Math.floor(Math.random() * 72)),
      })
      .onConflictDoNothing();
  }
  console.log(`✅ Audit logs créés (${auditEntries.length} entrées)`);

  // ─── Résumé ──────────────────────────────────────────────────────
  console.log('\n🎉 Seed complet terminé avec succès !\n');
  console.log('📊 Données insérées :');
  console.log(`   • ${deptData.length} départements`);
  console.log(`   • ${slaData.length} politiques SLA (toutes catégories × priorités)`);
  console.log(`   • ${userData.length} utilisateurs (13 comptes de test)`);
  console.log(`   • ${ticketsData.length} tickets (statuts et priorités variés)`);
  console.log(`   • ${assignedTickets.length} assignations de tickets`);
  console.log(`   • Commentaires sur 12 tickets`);
  console.log(`   • 8 notes internes superviseur`);
  console.log(`   • ${notifData.length} notifications`);
  console.log(`   • ${auditEntries.length} entrées d'audit\n`);
  console.log('🔑 Comptes de test :');
  console.log('   admin@telecom.local          → Admin@1234');
  console.log('   supervisor@telecom.local     → Super@1234');
  console.log('   supervisor-noc@telecom.local → Super@1234');
  console.log('   agent-cc1@telecom.local      → Agent@1234');
  console.log('   noc1@telecom.local           → Agent@1234');
  console.log('   billing1@telecom.local       → Agent@1234');
  console.log('   tech1@telecom.local          → Agent@1234');
  console.log('   field1@telecom.local         → Agent@1234\n');

  await client.end();
}

seed().catch((err) => {
  console.error('❌ Erreur lors du seed:', err);
  process.exit(1);
});
