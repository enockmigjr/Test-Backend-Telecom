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

    // Enregistrer le layout de base global en tant que partial Handlebars
    try {
      const baseLayoutSource = readFileSync(join(this.templateDir, 'base.hbs'), 'utf-8');
      Handlebars.registerPartial('base', baseLayoutSource);
      this.logger.log('Partial layout de base e-mail enregistré avec succès');
    } catch (err) {
      this.logger.warn(`Impossible d'enregistrer le partial de base e-mail: ${(err as Error).message}`);
    }

    const isDev = (process.env['NODE_ENV'] || 'development') === 'development';

    if (isDev) {
      this.transporter = nodemailer.createTransport({
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '1025', 10),
        secure: false,
        ignoreTLS: true,
        connectionTimeout: 2000,
        greetingTimeout: 2000,
      });
      this.logger.log('Email configuré pour développement (Mailpit)');
    } else {
      this.transporter = nodemailer.createTransport({
        host: process.env['SMTP_HOST'] || 'localhost',
        port: parseInt(process.env['SMTP_PORT'] || '587', 10),
        secure: process.env['SMTP_SECURE'] === 'true',
        auth: { user: process.env['SMTP_USER'] || '', pass: process.env['SMTP_PASSWORD'] || '' },
        connectionTimeout: 5000,
        greetingTimeout: 5000,
      });
      this.logger.log('Email configuré pour production (SMTP)');
    }
  }

  /**
   * Compile un template Handlebars à partir du système de fichiers.
   */
  private compileTemplate(name: string): HandlebarsTemplateDelegate {
    // Convertir les noms de template camelCase ou PascalCase en kebab-case
    // Exemple: ticketCreated -> ticket-created, slaBreach -> sla-breach
    const kebabName = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    if (!this.compiledTemplates.has(kebabName)) {
      const filePath = join(this.templateDir, `${kebabName}.hbs`);
      const source = readFileSync(filePath, 'utf-8');
      this.compiledTemplates.set(kebabName, Handlebars.compile(source));
    }
    return this.compiledTemplates.get(kebabName)!;
  }

  /**
   * Envoie un email en utilisant un template Handlebars.
   */
  async sendTemplate(
    to: string,
    subject: string,
    templateName: string,
    data: Record<string, unknown>,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    const template = this.compileTemplate(templateName);

    // Déterminer la couleur de l'accent et le texte de pied de page selon le type de template
    let accentColor = '#111111';
    let footerText = `Cet e-mail vous a été envoyé par la plateforme de gestion de tickets.`;

    if (templateName.toLowerCase().includes('breach')) {
      accentColor = '#dc2626'; // Rouge pour les violations de SLA
      footerText = `Alerte de dépassement générée automatiquement par le moteur SLA.`;
    } else if (templateName.toLowerCase().includes('warning')) {
      accentColor = '#f59e0b'; // Orange/Ambre pour les avertissements SLA imminent
      footerText = `Notification préventive générée par le moteur SLA.`;
    } else if (templateName.toLowerCase().includes('assign')) {
      footerText = `Vous recevez cet e-mail car vous êtes assigné à ce ticket.`;
    } else if (templateName.toLowerCase().includes('create')) {
      footerText = `E-mail de confirmation envoyé suite à la création.`;
    } else if (templateName.toLowerCase().includes('password')) {
      footerText = `Notification de sécurité liée à votre compte.`;
    } else if (templateName.toLowerCase().includes('failed')) {
      accentColor = '#dc2626';
      footerText = `Notification système faisant suite à un incident de traitement.`;
    }

    const appName = process.env['APP_NAME'] || 'Helpdesk Telecom';
    const appUrl = process.env['APP_URL'] || 'https://helpdesk.telecom.com';

    const mergedContext = {
      appName,
      appUrl,
      logoUrl: process.env['LOGO_URL'] || 'https://helpdesk.telecom.com/logo.png',
      settingsUrl: `${appUrl}/settings/notifications`,
      supportUrl: `${appUrl}/support`,
      companyName: 'Telecom Inc.',
      companyAddress: '12 avenue du Réseau, 75001 Paris',
      year: new Date().getFullYear(),
      subject,
      accentColor,
      footerText,
      ...data,
    };

    const html = template(mergedContext);
    await this.send(to, subject, html, attachments);
  }

  /**
   * Envoie un email avec HTML brut.
   */
  async send(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    try {
      const info = await this.transporter.sendMail({ from: this.from, to, subject, html, attachments });
      this.logger.log(`Email envoyé à ${to}: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Échec envoi email à ${to}: ${(error as Error).message}`);
      throw error;
    }
  }

  templates = {
    reportFailed: (data: { reportId: string; errorMessage: string }) => `
      <h2>❌ Échec de génération de rapport</h2>
      <p>Bonjour,</p>
      <p>La génération du rapport (ID : <strong>${data.reportId}</strong>) a échoué.</p>
      <p><strong>Détails de l'erreur :</strong></p>
      <blockquote style="background:#f9f9f9;border-left:5px solid #dc2626;padding:10px;margin:10px 0;">
        ${data.errorMessage}
      </blockquote>
      <p>Veuillez réessayer ultérieurement ou contacter l'équipe support.</p>
      <hr><small>Telecom Ticket Management — Message automatique d'erreur</small>
    `,

    ticketCreated: (data: { ticketNumber: string; title: string; priority: string; category?: string }) => `
      <h2>Ticket créé — ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.title}</p>
      <p><strong>Catégorie:</strong> ${data.category ?? 'Non renseigne'}</p>
      <p><strong>Priorité:</strong> ${data.priority}</p>
      <p>Votre ticket a été enregistré et sera traité dans les plus brefs délais.</p>
      <hr><small>Telecom Ticket Management — Ne pas répondre à cet email</small>
    `,

    ticketAssigned: (data: {
      ticketNumber: string;
      ticketTitle?: string;
      title?: string;
      supervisorName?: string;
      category?: string;
      severity?: string;
      priority?: string;
      department?: string;
      slaDueAt?: string;
    }) => `
      <h2>Ticket assigné — ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.ticketTitle ?? data.title ?? 'Sans titre'}</p>
      <p><strong>Assigné par:</strong> ${data.supervisorName ?? 'Un superviseur'}</p>
      <p><strong>Catégorie:</strong> ${data.category ?? 'Non renseigne'}</p>
      <p><strong>Sévérité/Priorité:</strong> ${data.severity ?? data.priority ?? 'Non renseigne'}</p>
      <p><strong>Département:</strong> ${data.department ?? 'Non renseigne'}</p>
      <p><strong>SLA résolution:</strong> ${data.slaDueAt ?? 'Non renseigne'}</p>
      <p>Ce ticket vous a été assigné. Veuillez en prendre connaissance.</p>
      <hr><small>Telecom Ticket Management — Ne pas répondre à cet email</small>
    `,

    slaBreach: (data: {
      ticketNumber: string;
      ticketTitle?: string;
      title?: string;
      slaExpiredAt?: string;
      overdueBy?: string;
    }) => `
      <h2>⚠�? Alerte SLA — ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.ticketTitle ?? data.title ?? 'Sans titre'}</p>
      <p><strong>Échéance dépassée:</strong> ${data.slaExpiredAt ?? 'Non renseigne'}</p>
      <p><strong>Retard:</strong> ${data.overdueBy ?? 'Non renseigne'}</p>
      <p style="color:red;">Le SLA de ce ticket a été dépassé. Action immédiate requise.</p>
      <hr><small>Telecom Ticket Management — Alerte automatique</small>
    `,

    slaWarning: (data: {
      ticketNumber: string;
      ticketTitle?: string;
      slaDueAt?: string;
      remainingMinutes?: number;
    }) => `
      <h2>Alerte SLA proche � ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.ticketTitle ?? 'Sans titre'}</p>
      <p><strong>�ch�ance:</strong> ${data.slaDueAt ?? 'Non renseigne'}</p>
      <p><strong>Temps restant:</strong> ${data.remainingMinutes ?? 'N/A'} minutes</p>
      <p>Veuillez traiter ce ticket rapidement pour �viter une violation SLA.</p>
      <hr><small>Telecom Ticket Management � Alerte automatique</small>
    `,

    passwordChanged: (data: { firstName: string; email?: string; changeDate: string }) => `
      <h2>🔒 Mot de passe modifié</h2>
      <p>Bonjour <strong>${data.firstName}</strong>,</p>
      <p>Votre mot de passe a été modifié le ${data.changeDate}.</p>
      <p>Si vous n'êtes pas à l'origine de cette modification, contactez immédiatement votre administrateur.</p>
      <hr><small>Telecom Ticket Management — Sécurité</small>
    `,

    accountCreated: (data: {
      firstName: string;
      lastName: string;
      email: string;
      temporaryPassword: string;
      role?: string;
      departmentName?: string;
      loginUrl: string;
    }) => `
      <h2>👤 Compte créé — Bienvenue</h2>
      <p>Bonjour <strong>${data.firstName} ${data.lastName}</strong>,</p>
      <p>Votre compte a été créé: <strong>${data.email}</strong></p>
      <p>Rôle: <strong>${data.role ?? 'Non renseigne'}</strong></p>
      <p>Departement: <strong>${data.departmentName ?? 'Non renseigne'}</strong></p>
      <p>Mot de passe temporaire: <code>${data.temporaryPassword}</code></p>
      <p><a href="${data.loginUrl}">Se connecter</a></p>
      <hr><small>Telecom Ticket Management — Ne pas répondre à cet email</small>
    `,

    adminWeeklyReport: (data: {
      weekNumber: string;
      periodStart: string;
      periodEnd: string;
      totalCreated: number;
      totalResolved: number;
      totalOpen: number;
      slaBreaches: number;
      complianceRate: string;
      avgResolutionMinutes: number;
    }) => `
      <h2>📈 Rapport Hebdomadaire — Semaine ${data.weekNumber}</h2>
      <p><strong>Période:</strong> ${data.periodStart} → ${data.periodEnd}</p>
      <table><tr><td>Créés:</td><td>${data.totalCreated}</td></tr>
      <tr><td>Résolus:</td><td>${data.totalResolved}</td></tr>
      <tr><td>Ouverts:</td><td>${data.totalOpen}</td></tr>
      <tr><td>Violations SLA:</td><td>${data.slaBreaches}</td></tr>
      <tr><td>Conformité:</td><td>${data.complianceRate}%</td></tr>
      <tr><td>Temps moyen:</td><td>${data.avgResolutionMinutes} min</td></tr></table>
      <hr><small>Telecom Ticket Management — Rapport automatique</small>
    `,
  };
}
