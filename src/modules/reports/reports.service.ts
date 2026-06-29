import { Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { tickets, departments } from '../../database/schemas';
import { eq, and, gte, lte, isNull, count, sql } from 'drizzle-orm';
import * as PDFDocument from 'pdfkit';
import { Writable } from 'stream';

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

    if (!ticket) throw new Error('Ticket non trouvé');

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
}
