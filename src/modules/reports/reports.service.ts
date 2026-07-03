import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, departments } from '../../database/schemas';
import { eq, and, gte, lte, isNull, count, sql } from 'drizzle-orm';
import PDFDocument from 'pdfkit';
import { Writable } from 'stream';

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

export interface SlaStatsReportData {
  total: number;
  breached: number;
  avgResolutionMinutes: number;
}

export interface SlaPriorityReportData {
  priority: string | null;
  count: number;
  breached: number;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Génère les données pour un rapport détaillé d'un ticket.
   */
  async ticketReport(ticketId: string) {
    const [ticket] = await this.drizzle.db
      .select({
        id: tickets.id,
        ticketNumber: tickets.ticketNumber,
        title: tickets.title,
        description: tickets.description,
        status: tickets.status,
        priority: tickets.priority,
        severity: tickets.severity,
        category: tickets.category,
        createdAt: tickets.createdAt,
        resolvedAt: tickets.resolvedAt,
        closedAt: tickets.closedAt,
        customerName: tickets.customerName,
        resolutionSummary: tickets.resolutionSummary,
        departmentName: departments.name,
      })
      .from(tickets)
      .leftJoin(departments, eq(tickets.departmentId, departments.id))
      .where(and(eq(tickets.id, ticketId), isNull(tickets.deletedAt)))
      .limit(1);

    if (!ticket) throw new NotFoundException(`Ticket introuvable pour l'id ${ticketId}.`);

    return {
      generatedAt: new Date().toISOString(),
      type: 'ticket-report',
      ticket,
    };
  }

  /**
   * Génère les données pour un rapport SLA (tous les tickets d'une période).
   */
  async slaReport(from?: string, to?: string) {
    const fromDate = from ? new Date(from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const toDate = to ? new Date(to) : new Date();

    const where = and(gte(tickets.createdAt, fromDate), lte(tickets.createdAt, toDate), isNull(tickets.deletedAt));

    const [stats] = await this.drizzle.db
      .select({
        total: count(),
        breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
        avgResolutionMinutes: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (${tickets.resolvedAt} - ${tickets.createdAt})) / 60) FILTER (WHERE ${tickets.resolvedAt} IS NOT NULL), 0)`,
      })
      .from(tickets)
      .where(where);

    const byPriority = await this.drizzle.db
      .select({
        priority: tickets.priority,
        count: count(),
        breached: sql<number>`COUNT(*) FILTER (WHERE ${tickets.slaBreached} = true)`,
      })
      .from(tickets)
      .where(where)
      .groupBy(tickets.priority);

    return {
      generatedAt: new Date().toISOString(),
      type: 'sla-report',
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      summary: {
        total: Number(stats?.total || 0),
        breached: Number(stats?.breached || 0),
        avgResolutionMinutes: Math.round(Number(stats?.avgResolutionMinutes || 0)),
      },
      byPriority,
    };
  }

  /** Génère un PDF avec PDFKit */
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
   * Génère un PDF stylisé et complet pour un ticket d'incident.
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
      doc.fillColor('#111111').moveDown(4);

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

      // Footer
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text('Platform Trouble Ticket Management — Telecom Inc.', 40, doc.page.height - 40, { align: 'center' });

      doc.end();
      writable.on('finish', () => resolve(Buffer.concat(chunks)));
      writable.on('error', reject);
    });
  }

  /**
   * Génère un PDF complet et esthétique pour les statistiques SLA d'une période.
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
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
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
      doc.moveDown(1.5);

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
        doc.text(p.priority, 50, rowY);
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

      // Footer
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text("Moteur SLA d'observabilité — Telecom Inc.", 40, doc.page.height - 40, { align: 'center' });

      doc.end();
      writable.on('finish', () => resolve(Buffer.concat(chunks)));
      writable.on('error', reject);
    });
  }
}
