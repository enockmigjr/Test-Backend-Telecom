import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

/**
 * Service d'envoi d'emails.
 *
 * Dev: utilise Mailpit (SMTP localhost:1025, pas d'auth)
 * Prod: utilise le SMTP configuré via variables d'environnement
 *
 * L'envoi est asynchrone et ne bloque jamais la réponse HTTP.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly from: string;

  constructor() {
    this.from = process.env['SMTP_FROM'] || 'noreply@telecom-tickets.local';

    const isDev = (process.env['NODE_ENV'] || 'development') === 'development';

    if (isDev) {
      // Mailpit — pas d'auth, pas de TLS
      this.transporter = nodemailer.createTransport({
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '1025', 10),
        secure: false,
        ignoreTLS: true,
      });
      this.logger.log('Email configuré pour développement (Mailpit)');
    } else {
      // Production — SMTP réel avec auth
      this.transporter = nodemailer.createTransport({
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: {
          user: process.env['SMTP_USER'] || '',
          pass: process.env['SMTP_PASSWORD'] || '',
        },
      });
      this.logger.log('Email configuré pour production (SMTP)');
    }
  }

  /**
   * Envoie un email de manière asynchrone.
   * Retourne immédiatement — les erreurs sont loguées.
   */
  async send(to: string, subject: string, html: string): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html,
      });
      this.logger.log(`Email envoyé à ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Échec envoi email à ${to}: ${(error as Error).message}`);
      throw error; // Relancer pour que BullMQ puisse retry
    }
  }

  /**
   * Templates d'emails intégrés.
   */
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
