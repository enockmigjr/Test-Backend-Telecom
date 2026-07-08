import { Injectable, Logger } from '@nestjs/common';
import { DrizzleProvider } from '../../database/drizzle.provider';
import { settings } from '../../database/schemas/settings';
import { eq } from 'drizzle-orm';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private cache = new Map<string, { value: string; expiresAt: number }>();
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  constructor(private readonly drizzle: DrizzleProvider) {}

  /**
   * Récupère une valeur de configuration par sa clé avec cache et valeur par défaut.
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
   * Met à jour ou crée un paramètre système.
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

      // Invalider le cache local
      this.cache.delete(key);
    } catch (err) {
      this.logger.error(`Erreur d'écriture du setting ${key}: ${String(err)}`);
      throw err;
    }
  }

  /**
   * Récupère tous les paramètres.
   */
  async getAllSettings() {
    return this.drizzle.db.select().from(settings);
  }

  /**
   * Helper pour récupérer les heures de bureau.
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
   * Helper pour récupérer la charge concurrente max par agent.
   */
  async getMaxConcurrentTickets(): Promise<number> {
    const val = await this.getSetting('MAX_CONCURRENT_TICKETS', '5');
    return parseInt(val, 10) || 5;
  }

  /**
   * Helper pour récupérer la liste des jours ouvrables sous forme de tableau d'entiers (ex: [1, 2, 3, 4, 5]).
   */
  async getBusinessDays(): Promise<number[]> {
    const val = await this.getSetting('BUSINESS_DAYS', '1,2,3,4,5');
    return val
      .split(',')
      .map((d) => parseInt(d.trim(), 10))
      .filter((d) => !isNaN(d));
  }
}
