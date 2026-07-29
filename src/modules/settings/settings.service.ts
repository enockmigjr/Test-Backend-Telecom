/**
 * ============================================================================
 * FICHIER : src/modules/settings/settings.service.ts
 * RÔLE : Service de gestion des clés de configuration dynamiques et règles de fonctionnement.
 * EXPLICATION :
 * Ce service centralise la configuration dynamique du système télécom (heures ouvrées, charge d'agent max...) :
 * 1. Cache mémoire local (TTL 60 secondes) : Réduit les requêtes PostgreSQL répétitives lors des calculs massifs de SLAs.
 * 2. `getSetting` & `updateSetting` : Extrait et met à jour les paires clé-valeur avec auto-invalidation du cache.
 * 3. Helpers métier : `getBusinessHours` (ex: 8h-18h), `getMaxConcurrentTickets` (ex: 5 tickets max par agent), `getBusinessDays` (ex: [1,2,3,4,5] du lundi au vendredi).
 * ============================================================================
 */

import { Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { settings } from '../../database/schemas/settings';
import { eq } from 'drizzle-orm';

/**
 * Service gérant les paramètres système dynamiques et leur mise en cache temporaire.
 */
@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly CACHE_TTL = 60 * 1000; // Cache en mémoire de 60 secondes

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Extrait une valeur de configuration par sa clé avec mise en cache mémoire de 60 secondes.
   *
   * @param key Clé de configuration unique.
   * @param defaultValue Valeur de secours par défaut si la clé n'est pas définie en base.
   */
  async getSetting(key: string, defaultValue: string): Promise<string> {
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    try {
      const [record] = await this.drizzle.db.select().from(settings).where(eq(settings.key, key)).limit(1);

      const val = record ? record.value : defaultValue;
      this.cache.set(key, { value: val, expiresAt: now + this.CACHE_TTL });
      return val;
    } catch (err) {
      this.logger.error(`Erreur de lecture du setting ${key}: ${String(err)}`);
      return defaultValue;
    }
  }

  /**
   * Insère ou met à jour une clé de configuration système et invalide l'entrée de cache correspondante.
   *
   * @param key Clé unique du paramètre.
   * @param value Valeur sous forme de chaîne de caractères (ou JSON sérialisé).
   * @param description Description fonctionnelle du paramètre.
   */
  async updateSetting(key: string, value: string, description?: string): Promise<void> {
    try {
      const [existing] = await this.drizzle.db.select().from(settings).where(eq(settings.key, key)).limit(1);

      if (existing) {
        await this.drizzle.db
          .update(settings)
          .set({ value, description: description ?? existing.description, updatedAt: new Date() })
          .where(eq(settings.key, key));
      } else {
        const { generateUuid } = await import('../../common/helpers/uuidv7.helper');
        await this.drizzle.db.insert(settings).values({
          id: generateUuid(),
          key,
          value,
          description: description ?? '',
        });
      }

      // Invalider immédiatement le cache local
      this.cache.delete(key);
    } catch (err) {
      this.logger.error(`Erreur d'écriture du setting ${key}: ${String(err)}`);
      throw err;
    }
  }

  /**
   * Extrait l'ensemble des paramètres de configuration depuis PostgreSQL.
   */
  async getAllSettings() {
    return this.drizzle.db.select().from(settings);
  }

  /**
   * Extrait la plage horaire ouvrée configurée (heures de début et de fin).
   */
  async getBusinessHours(): Promise<{ start: number; end: number }> {
    const startStr = await this.getSetting('BUSINESS_HOURS_START', '8');
    const endStr = await this.getSetting('BUSINESS_HOURS_END', '18');

    return {
      start: parseInt(startStr, 10) || 8,
      end: parseInt(endStr, 10) || 18,
    };
  }

  /**
   * Extrait le nombre maximal de tickets simultanés autorisés par agent pour le moteur d'auto-assignation.
   */
  async getMaxConcurrentTickets(): Promise<number> {
    const val = await this.getSetting('MAX_CONCURRENT_TICKETS', '5');
    return parseInt(val, 10) || 5;
  }

  /**
   * Extrait la liste des jours ouvrés de la semaine (1 = Lundi, 5 = Vendredi).
   */
  async getBusinessDays(): Promise<number[]> {
    const val = await this.getSetting('BUSINESS_DAYS', '1,2,3,4,5');
    return val
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => !isNaN(d));
  }
}
