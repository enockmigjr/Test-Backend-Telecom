/**
 * ============================================================================
 * FICHIER : src/app.module.ts
 * RÔLE : Module racine de l'application backend NestJS.
 * EXPLICATION (Pour non-développeurs) :
 * Ce fichier agit comme le "chef d'orchestre" de l'application. Il assemble et
 * connecte tous les modules spécialisés du projet :
 * 1. Les modules d'infrastructures (base de données, Redis, logs, sécurité).
 * 2. Les modules métier (authentification, tickets, utilisateurs, notifications, SLA, etc.).
 * 3. Les règles de sécurité globales (pare-feu anti-brute force, vérification JWT).
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from './common/providers/throttler-storage-redis.provider';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app.config';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';

// Importation des 16 modules métier du backend
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { PasswordChangeRequiredGuard } from './modules/auth/guards/password-change-required.guard';
import { DepartmentsModule } from './modules/departments/departments.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { UsersModule } from './modules/users/users.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { CommentsModule } from './modules/comments/comments.module';
import { InternalNotesModule } from './modules/internal-notes/internal-notes.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SlaModule } from './modules/sla/sla.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { WebSocketModule } from './websocket/websocket.module';
import { QueuesModule } from './queues/queues.module';
import { AppInfoModule } from './modules/app/app.module';
import { HealthModule } from './common/health/health.module';
import { MetricsModule } from './common/metrics/metrics.module';
import { ObservabilityModule } from './common/observability/observability.module';
import { EmailModule } from './modules/email/email.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BullBoardModule } from './common/bull-board/bull-board.module';
import { SettingsModule } from './modules/settings/settings.module';
import { IdempotencyInterceptor } from './common/interceptors/idempotency.interceptor';
import { isAuthRateLimited } from './common/decorators/auth-rate-limited.decorator';

/**
 * Décorateur @Module indiquant à NestJS l'organisation et la structure de l'application.
 */
@Module({
  imports: [
    // 1. Module de chargement des variables d'environnement (.env)
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AppConfigModule,

    // 2. Logger structuré Pino (gestion avancée des journaux d'événements)
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        pinoHttp: {
          level: config.logLevel,
          transport: config.isDev
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
          quietReqLogger: true,
          autoLogging: false,
          formatters: {
            level: (label: string) => ({ level: label }),
          },
        },
      }),
    }),

    // 3. Limitation du nombre de requêtes par minute (Anti-DDoS et protection Brute-Force via Redis)
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            name: 'default',
            ttl: config.throttleTtl,
            limit: config.throttleLimit,
          },
          {
            name: 'auth',
            ttl: config.throttleAuthTtl,
            limit: config.throttleAuthLimit,
            skipIf: (context) => !isAuthRateLimited(context.getHandler()),
          },
        ],
        storage: new ThrottlerStorageRedisService(),
      }),
    }),

    // 4. Planificateur de tâches récurrentes (@Cron, tâches d'arrière-plan automatisées)
    ScheduleModule.forRoot(),

    // 5. Gestionnaire d'événements internes (Domain Events asynchrones)
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: false,
    }),

    // 6. Socle d'infrastructures communes et accès base de données
    DatabaseModule,
    CommonModule,

    // 7. Assemblage de l'ensemble des modules fonctionnels et métier du système
    AppInfoModule,
    HealthModule,
    MetricsModule,
    ObservabilityModule,
    EmailModule,
    ReportsModule,
    AuthModule,
    DepartmentsModule,
    CategoriesModule,
    UsersModule,
    TicketsModule,
    CommentsModule,
    InternalNotesModule,
    AttachmentsModule,
    NotificationsModule,
    SlaModule,
    DashboardModule,
    AuditLogsModule,
    WebSocketModule,
    QueuesModule,
    BullBoardModule,
    SettingsModule,
  ],
  providers: [
    // Protection globale contre le surdimensionnement des requêtes (Rate Limiting)
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Protection globale par authentification JWT (bloque tout accès non authentifié par défaut)
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Vérification globale forçant le changement du mot de passe temporaire
    {
      provide: APP_GUARD,
      useClass: PasswordChangeRequiredGuard,
    },
    // Prévention des requêtes envoyées plusieurs fois par erreur (Idempotence)
    {
      provide: APP_INTERCEPTOR,
      useClass: IdempotencyInterceptor,
    },
  ],
  controllers: [],
})
export class AppModule {}

