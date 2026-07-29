/**
 * ============================================================================
 * FICHIER : src/modules/email/email.service.ts
 * RÔLE : Service de composition et d'expédition d'emails transactionnels (Nodemailer + Handlebars).
 * EXPLICATION :
 * Ce service assure la génération et l'envoi des notifications par courrier électronique :
 * 1. Transporteur SMTP : Utilise Mailpit (`localhost:1025`) en développement et un serveur SMTP sécurisé en production.
 * 2. Moteur de templates Handlebars : Charge de manière dynamique les gabarits `.hbs` dans `src/modules/email/templates/`, enregistre le layout global `base.hbs`, et applique une mise en forme visuelle (couleurs d'accentuation d'urgence pour SLA).
 * 3. `sendTemplate` : Compile, injecte le contexte applicatif (liens, logo, pied de page) et expédie l'email.
 * 4. `send` : Méthode bas niveau d'expédition HTML directe avec support des pièces jointes binaires (rapports PDF).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Service gérant la mise en page HTML, la compilation Handlebars et l'envoi SMTP d'emails.
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
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chemin construit statiquement depuis __dirname + constante, sans input utilisateur
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
   * Compile un template Handlebars à partir du système de fichiers en le convertissant en kebab-case.
   *
   * @param name Nom du template (ex: 'ticketCreated' -> 'ticket-created.hbs').
   * @returns La fonction déléguée Handlebars compilée.
   */
  private compileTemplate(name: string): HandlebarsTemplateDelegate {
    const kebabName = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

    if (!this.compiledTemplates.has(kebabName)) {
      const filePath = join(this.templateDir, `${kebabName}.hbs`);
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Chemin construit depuis templateDir (statique) + nom de template sanitisé (kebab-case)
      const source = readFileSync(filePath, 'utf-8');
      this.compiledTemplates.set(kebabName, Handlebars.compile(source));
    }
    return this.compiledTemplates.get(kebabName)!;
  }

  /**
   * Envoie un e-mail au format HTML en utilisant un modèle Handlebars précompilé et enrichi du contexte système.
   *
   * @param to Adresse email du destinataire.
   * @param subject Objet de l'e-mail.
   * @param templateName Nom du modèle Handlebars.
   * @param data Variables d'injection pour le modèle.
   * @param attachments Fichiers joints optionnels (ex: rapports PDF).
   */
  async sendTemplate(
    to: string,
    subject: string,
    templateName: string,
    data: Record<string, unknown>,
    attachments?: Array<{ filename: string; content: Buffer }>,
  ): Promise<void> {
    const template = this.compileTemplate(templateName);

    // Déterminer la couleur de l'accentuation visuelle et le texte de pied de page selon le type de notification
    let accentColor = '#111111';
    let footerText = `Cet e-mail vous a été envoyé par la plateforme de gestion de tickets.`;

    if (templateName.toLowerCase().includes('breach')) {
      accentColor = '#dc2626'; // Rouge d'urgence pour les violations de SLA
      footerText = `Alerte de dépassement générée automatiquement par le moteur SLA.`;
    } else if (templateName.toLowerCase().includes('warning')) {
      accentColor = '#f59e0b'; // Ambre préventif pour les avertissements SLA imminents
      footerText = `Notification préventive générée par le moteur SLA.`;
    } else if (templateName.toLowerCase().includes('deassigned') || templateName.toLowerCase().includes('deassign')) {
      accentColor = '#dc2626'; // Rouge pour les réallocations d'urgence
      footerText = `Notification de désassignation générée par le moteur d'auto-assignation.`;
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
   * Envoie directement un e-mail HTML au destinataire via le transporteur Nodemailer.
   *
   * @param to Adresse du destinataire.
   * @param subject Sujet du courriel.
   * @param html Contenu HTML compilé.
   * @param attachments Liste optionnelle de fichiers joints.
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

    ticketDeassigned: (data: { ticketNumber: string; ticketTitle?: string; title?: string; reason: string }) => `
      <h2>📋 Ticket désassigné d'urgence — ${data.ticketNumber}</h2>
      <p><strong>Titre:</strong> ${data.ticketTitle ?? data.title ?? 'Sans titre'}</p>
      <p><strong>Motif:</strong> ${data.reason}</p>
      <p>Le ticket a été désassigné automatiquement pour cause d'indisponibilité afin d'éviter une violation de SLA.</p>
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
