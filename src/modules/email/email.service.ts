import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Service d'envoi d'emails avec compilation Handlebars.
 *
 * Dev: utilise Mailpit (SMTP localhost:1025, pas d'auth)
 * Prod: utilise le SMTP configuré via variables d'environnement
 *
 * Templates disponibles dans src/modules/email/templates/*.hbs
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly from: string;
  private readonly templateDir: string;
  private compiledTemplates = new Map<string, HandlebarsTemplateDelegate>();

  constructor() {
    this.from = process.env['SMTP_FROM'] || 'noreply@telecom-tickets.local';
    this.templateDir = join(__dirname, 'templates');

    const isDev = (process.env['NODE_ENV'] || 'development') === 'development';

    if (isDev) {
      this.transporter = nodemailer.createTransport({
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '1025', 10),
        secure: false,
        ignoreTLS: true,
      });
      this.logger.log('Email configuré pour développement (Mailpit)');
    } else {
      this.transporter = nodemailer.createTransport({
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: { user: process.env['SMTP_USER'] || '', pass: process.env['SMTP_PASSWORD'] || '' },
      });
      this.logger.log('Email configuré pour production (SMTP)');
    }
  }

  /**
   * Compile un template Handlebars à partir du système de fichiers.
   */
  private compileTemplate(name: string): HandlebarsTemplateDelegate {
    if (!this.compiledTemplates.has(name)) {
      const filePath = join(this.templateDir, `${name}.hbs`);
      const source = readFileSync(filePath, 'utf-8');
      this.compiledTemplates.set(name, Handlebars.compile(source));
    }
    return this.compiledTemplates.get(name)!;
  }

  /**
   * Envoie un email en utilisant un template Handlebars.
   */
  async sendTemplate(to: string, subject: string, templateName: string, data: Record<string, unknown>): Promise<void> {
    const template = this.compileTemplate(templateName);
    const html = template({ ...data, year: new Date().getFullYear() });
    await this.send(to, subject, html);
  }

  /**
   * Envoie un email avec HTML brut.
   */
  async send(to: string, subject: string, html: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Email envoyé à ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Échec envoi email à ${to}: ${(error as Error).message}`);
      throw error;
    }
  }

  /** Templates inline (fallback si Handlebars pas trouvé) */
  templates = {
    ticketCreated: (data: { ticketNumber: string; title: string; priority: string }) => `
      <h2>Ticket créé — ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.title}</p>
      <p><strong>Priorité:</strong> ${data.priority}</p>
      <p>Votre ticket a été enregistré et sera traité dans les plus brefs délais.</p>
      <hr><small>Telecom Ticket Management — Ne pas répondre à cet email</small>
    `,

    ticketAssigned: (data: { ticketNumber: string; title: string; assignedBy: string }) => `
      <h2>Ticket assigné — ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.title}</p>
      <p><strong>Assigné par:</strong> ${data.assignedBy}</p>
      <p>Ce ticket vous a été assigné. Veuillez en prendre connaissance.</p>
      <hr><small>Telecom Ticket Management — Ne pas répondre à cet email</small>
    `,

    slaBreach: (data: { ticketNumber: string; title: string; dueDate: string }) => `
      <h2>⚠️ Alerte SLA — ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.title}</p>
      <p><strong>Échéance dépassée:</strong> ${data.dueDate}</p>
      <p style="color:red;">Le SLA de ce ticket a été dépassé. Action immédiate requise.</p>
      <hr><small>Telecom Ticket Management — Alerte automatique</small>
    `,
  };
}
