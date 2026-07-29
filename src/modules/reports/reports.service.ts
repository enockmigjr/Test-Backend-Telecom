/**
 * ============================================================================
 * FICHIER : src/modules/reports/reports.service.ts
 * RÔLE : Service de génération dynamique de documents PDF et de persistance des métadonnées de rapport.
 * EXPLICATION :
 * Ce service utilise la bibliothèque PDFKit pour construire des documents PDF vectoriels haute qualité :
 * 1. `generateTicketPdf` : Dessine un document PDF format A4 stylisé pour un ticket d'incident (en-tête sombre, sections structurées, détails opérationnels, délais).
 * 2. `generateSlaPdf` : Construit un tableau de bord PDF de conformité SLA (cartes statistiques de KPIs avec codes couleurs, tableau par priorité avec alternance de couleur de ligne).
 * 3. `createReport` & `updateReportStatus` : Gère le cycle de vie du rapport (`pending` -> `completed` / `failed`) et enregistre le chemin `objectKey` ou l'erreur.
 * ============================================================================
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { reports, NewReport, Report } from '../../database/schemas';
import { eq } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';
import { Queue } from 'bullmq';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ReportQueryService } from './report-query.service';

/** Données requises pour le rapport PDF d'un ticket. */
export interface TicketReportData {
  ticketNumber?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  severity?: string | null;
  category?: string | null;
  createdAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  closedAt?: Date | string | null;
  customerName?: string | null;
  resolutionSummary?: string | null;
  departmentName?: string | null;
}

/** Métriques globales pour le rapport SLA. */
export interface SlaStatsReportData {
  total: number;
  breached: number;
  avgResolutionMinutes: number;
}

/** Données de ventilation par priorité pour le rapport SLA. */
export interface SlaPriorityReportData {
  priority: string | null;
  count: number;
  breached: number;
}

/**
 * Service central de compilation PDF avec PDFKit et d'enregistrement des rapports.
 */
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly drizzle: DrizzleProvider,
    @Inject('BullMQ_Queues') private readonly queues: { report: Queue },
    private readonly reportQuery: ReportQueryService,
  ) {}

  /**
   * Délègue l'extraction des données brutes d'un ticket au service de requête.
   */
  async ticketReport(ticketId: string, user?: JwtPayload) {
    return this.reportQuery.ticketReport(ticketId, user);
  }

  /**
   * Délègue l'extraction des statistiques SLA au service de requête.
   */
  async slaReport(from?: string, to?: string, departmentId?: string) {
    return this.reportQuery.slaReport(from, to, departmentId);
  }

  /**
   * Génère un PDF générique à partir d'un titre, d'en-têtes et de lignes de tableau.
   *
   * @param reportData Données structurées du tableau.
   * @returns Un Buffer binaire contenant le document PDF généré.
   */
  async generatePdf(reportData: { title: string; headers: string[]; rows: string[][] }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      doc.pipe(writable);
      doc.fontSize(18).font('Helvetica-Bold').text(reportData.title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Généré le ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
      doc.moveDown(2);
      const colWidth = (doc.page.width - 100) / reportData.headers.length;
      doc.font('Helvetica-Bold').fontSize(9);
      reportData.headers.forEach((h, i) => doc.text(h, 50 + i * colWidth, doc.y, { width: colWidth, continued: true }));
      doc.moveDown(1.5);
      doc.font('Helvetica').fontSize(8);
      reportData.rows.forEach((row) => {
        row.forEach((c, i) => doc.text(c, 50 + i * colWidth, doc.y, { width: colWidth, continued: true }));
        doc.moveDown(0.5);
      });
      doc.end();
      writable.on('finish', () => resolve(Buffer.concat(chunks)));
      writable.on('error', reject);
    });
  }

  /**
   * Génère un fichier PDF élégant et complet présentant l'ensemble des détails d'un ticket d'incident.
   *
   * @param ticket Données de la fiche du ticket.
   * @returns Le tampon Buffer du document PDF.
   */
  async generateTicketPdf(ticket: TicketReportData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      doc.pipe(writable);

      // En-tête sombre stylé
      doc.rect(0, 0, doc.page.width, 100).fill('#111111');
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text("RAPPORT DE TICKET D'INCIDENT", 40, 30);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(`Référence : ${ticket.ticketNumber || 'N/A'}`, 40, 58);
      doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 40, 72);

      // Contenu
      doc.fillColor('#111111').moveDown(2);

      // Section titre & description
      doc.fontSize(14).font('Helvetica-Bold').text('Informations Générales', 40, doc.y);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, doc.y + 5)
        .lineTo(doc.page.width - 40, doc.y + 5)
        .stroke();
      doc.moveDown(1.5);

      const startY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').text('Titre :', 40, startY);
      doc.font('Helvetica').text(ticket.title || 'Sans titre', 150, startY, { width: 350 });

      doc.font('Helvetica-Bold').text('Description :', 40, doc.y + 10);
      doc.font('Helvetica').text(ticket.description || 'Aucune description', 150, doc.y, { width: 350 });

      const nextY = doc.y + 15;
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, nextY)
        .lineTo(doc.page.width - 40, nextY)
        .stroke();

      // Caractéristiques
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Détails Opérationnels', 40, nextY + 15);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, doc.y + 5)
        .lineTo(doc.page.width - 40, doc.y + 5)
        .stroke();
      doc.moveDown(1.5);

      const tableY = doc.y;

      // Colonne gauche
      doc.fontSize(10).font('Helvetica-Bold').text('Statut :', 40, tableY);
      doc.font('Helvetica').text(ticket.status || 'NEW', 150, tableY);

      doc.font('Helvetica-Bold').text('Priorité :', 40, tableY + 20);
      doc.font('Helvetica').text(ticket.priority || 'MEDIUM', 150, tableY + 20);

      doc.font('Helvetica-Bold').text('Sévérité :', 40, tableY + 40);
      doc.font('Helvetica').text(ticket.severity || 'MEDIUM', 150, tableY + 40);

      // Colonne droite
      doc.font('Helvetica-Bold').text('Catégorie :', 300, tableY);
      doc.font('Helvetica').text(ticket.category || 'N/A', 410, tableY);

      doc.font('Helvetica-Bold').text('Département :', 300, tableY + 20);
      doc.font('Helvetica').text(ticket.departmentName || 'N/A', 410, tableY + 20);

      doc.font('Helvetica-Bold').text('Client :', 300, tableY + 40);
      doc.font('Helvetica').text(ticket.customerName || 'N/A', 410, tableY + 40);

      const nextY2 = tableY + 70;
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, nextY2)
        .lineTo(doc.page.width - 40, nextY2)
        .stroke();

      // Dates
      doc
        .fontSize(14)
        .font('Helvetica-Bold')
        .text('Dates & Délais', 40, nextY2 + 15);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, doc.y + 5)
        .lineTo(doc.page.width - 40, doc.y + 5)
        .stroke();
      doc.moveDown(1.5);

      const datesY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold').text('Créé le :', 40, datesY);
      doc
        .font('Helvetica')
        .text(ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('fr-FR') : 'N/A', 150, datesY);

      doc.font('Helvetica-Bold').text('Résolu le :', 40, datesY + 20);
      doc
        .font('Helvetica')
        .text(ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleString('fr-FR') : 'Non résolu', 150, datesY + 20);

      doc.font('Helvetica-Bold').text('Clôturé le :', 40, datesY + 40);
      doc
        .font('Helvetica')
        .text(ticket.closedAt ? new Date(ticket.closedAt).toLocaleString('fr-FR') : 'Non clôturé', 150, datesY + 40);

      if (ticket.resolutionSummary) {
        const resY = datesY + 75;
        doc
          .strokeColor('#e5e7eb')
          .lineWidth(1)
          .moveTo(40, resY)
          .lineTo(doc.page.width - 40, resY)
          .stroke();
        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Résumé de Résolution', 40, resY + 15);
        doc
          .strokeColor('#e5e7eb')
          .lineWidth(1)
          .moveTo(40, doc.y + 5)
          .lineTo(doc.page.width - 40, doc.y + 5)
          .stroke();
        doc.moveDown(1.5);
        doc
          .fontSize(10)
          .font('Helvetica')
          .text(ticket.resolutionSummary, 40, doc.y, { width: doc.page.width - 80 });
      }

      // Pied de page
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text('Platform Trouble Ticket Management — Telecom Inc.', 40, doc.page.height - 45, { align: 'center' });

      doc.end();
      writable.on('finish', () => resolve(Buffer.concat(chunks)));
      writable.on('error', reject);
    });
  }

  /**
   * Génère un document PDF d'analyse de conformité SLA pour une période donnée.
   *
   * @param stats Synthèse globale des métriques.
   * @param byPriority Ventilation des données par priorité.
   * @param period Dates de début et de fin.
   * @returns Tampon Buffer PDF.
   */
  async generateSlaPdf(
    stats: SlaStatsReportData,
    byPriority: SlaPriorityReportData[],
    period: { from: Date; to: Date },
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const writable = new Writable({
        write(chunk: Buffer, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });
      const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 25, left: 40, right: 40 } });
      doc.pipe(writable);

      // En-tête rouge SLA
      doc.rect(0, 0, doc.page.width, 100).fill('#dc2626');
      doc.fillColor('#ffffff').fontSize(20).font('Helvetica-Bold').text('RAPPORT DE CONFORMITÉ SLA', 40, 30);
      doc
        .fontSize(10)
        .font('Helvetica')
        .text(
          `Période : du ${period.from.toLocaleDateString('fr-FR')} au ${period.to.toLocaleDateString('fr-FR')}`,
          40,
          58,
        );
      doc.text(`Généré le : ${new Date().toLocaleString('fr-FR')}`, 40, 72);

      // Contenu
      doc.fillColor('#111111').moveDown(4);

      // Section Indicateurs
      doc.fontSize(14).font('Helvetica-Bold').text('Indicateurs Clés de Performance', 40, doc.y);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, doc.y + 5)
        .lineTo(doc.page.width - 40, doc.y + 5)
        .stroke();
      doc.moveDown(1.5);

      const statsY = doc.y;

      // Cartes d'indicateurs
      // 1. Total Tickets
      doc.rect(40, statsY, 150, 60).fill('#f9fafb').stroke('#e5e7eb');
      doc
        .fillColor('#6b7280')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('TOTAL TICKETS', 50, statsY + 12);
      doc
        .fillColor('#111111')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(String(stats.total), 50, statsY + 28);

      // 2. Violations SLA
      doc.rect(210, statsY, 150, 60).fill('#f9fafb').stroke('#e5e7eb');
      doc
        .fillColor('#dc2626')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('VIOLATIONS SLA', 220, statsY + 12);
      doc
        .fillColor('#dc2626')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(String(stats.breached), 220, statsY + 28);

      // 3. Taux de conformité
      const compliance = stats.total > 0 ? (((stats.total - stats.breached) / stats.total) * 100).toFixed(1) : '100';
      doc.rect(380, statsY, 175, 60).fill('#f9fafb').stroke('#e5e7eb');
      doc
        .fillColor('#16a34a')
        .fontSize(8)
        .font('Helvetica-Bold')
        .text('TAUX DE CONFORMITÉ', 390, statsY + 12);
      doc
        .fillColor('#16a34a')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text(`${compliance}%`, 390, statsY + 28);

      doc.fillColor('#111111').moveDown(4.5);

      // Tableau par Priorité
      doc.fontSize(14).font('Helvetica-Bold').text('Performance par Niveau de Priorité', 40, doc.y);
      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, doc.y + 5)
        .lineTo(doc.page.width - 40, doc.y + 5)
        .stroke();
      doc.moveDown(0.8);

      const tableHeaderY = doc.y;
      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Priorité', 50, tableHeaderY);
      doc.text('Total Tickets', 180, tableHeaderY);
      doc.text('Violations SLA', 320, tableHeaderY);
      doc.text('Conformité', 460, tableHeaderY);

      doc
        .strokeColor('#111111')
        .lineWidth(1.5)
        .moveTo(40, tableHeaderY + 15)
        .lineTo(doc.page.width - 40, tableHeaderY + 15)
        .stroke();

      let rowY = tableHeaderY + 25;
      doc.font('Helvetica').fontSize(9);

      byPriority.forEach((p, idx) => {
        if (idx % 2 === 1) {
          doc.rect(40, rowY - 5, doc.page.width - 80, 20).fill('#f9fafb');
        }

        doc.fillColor('#111111');
        doc.text(p.priority || 'N/A', 50, rowY);
        doc.text(String(p.count), 180, rowY);
        doc.text(String(p.breached), 320, rowY);

        const rate = p.count > 0 ? (((p.count - p.breached) / p.count) * 100).toFixed(1) : '100';
        doc.text(`${rate}%`, 460, rowY);

        rowY += 20;
      });

      doc
        .strokeColor('#e5e7eb')
        .lineWidth(1)
        .moveTo(40, rowY + 5)
        .lineTo(doc.page.width - 40, rowY + 5)
        .stroke();

      // Temps moyen de résolution
      doc.moveDown(2);
      doc
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`Temps moyen de résolution de la période : ${stats.avgResolutionMinutes} minutes`, 40, doc.y);

      // Pied de page
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text("Moteur SLA d'observabilité — Telecom Inc.", 40, doc.page.height - 45, { align: 'center' });

      doc.end();
      writable.on('finish', () => resolve(Buffer.concat(chunks)));
      writable.on('error', reject);
    });
  }

  /**
   * Insère un nouvel enregistrement de rapport à l'état `pending`.
   *
   * @param data Métadonnées du rapport.
   */
  async createReport(data: NewReport): Promise<void> {
    await this.drizzle.db.insert(reports).values(data);
  }

  /**
   * Recherche un rapport par son identifiant unique.
   *
   * @param id UUID du rapport.
   */
  async getReport(id: string): Promise<Report> {
    return this.reportQuery.getReport(id);
  }

  /**
   * Met à jour l'état final d'un rapport (`completed` ou `failed`) avec le lien de fichier ou le message d'erreur.
   *
   * @param id UUID du rapport.
   * @param status État final.
   * @param objectKey Chemin du fichier sur le stockage local (si succès).
   * @param errorMessage Message d'erreur (si échec).
   */
  async updateReportStatus(
    id: string,
    status: 'completed' | 'failed',
    objectKey?: string,
    errorMessage?: string,
  ): Promise<void> {
    await this.drizzle.db
      .update(reports)
      .set({
        status,
        objectKey: objectKey || null,
        errorMessage: errorMessage || null,
        completedAt: new Date(),
      })
      .where(eq(reports.id, id));
  }

  /**
   * Extrait la liste paginée des rapports.
   *
   * @param page Page courante.
   * @param limit Nombre d'éléments par page.
   * @param requestedBy UUID de l'utilisateur demandeur (facultatif).
   */
  async listReports(
    page = 1,
    limit = 20,
    requestedBy?: string,
  ): Promise<{ data: Report[]; meta: { total: number; page: number; limit: number; totalPages: number } }> {
    return this.reportQuery.listReports(page, limit, requestedBy);
  }
}
