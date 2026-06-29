import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from './common/providers/throttler-storage-redis.provider';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app.config';
import { CommonModule } from './common/common.module';
import { DatabaseModule } from './database/database.module';

// Modules métier
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { DepartmentsModule } from './modules/departments/departments.module';
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

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    AppConfigModule,

    // Logger Pino
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
        },
      }),
    }),

    // Rate Limiting avec stockage Redis (distribué)
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
          },
        ],
        storage: new ThrottlerStorageRedisService(),
      }),
    }),

    // Planification (@Cron, @Interval)
    ScheduleModule.forRoot(),

    // Event Emitter pour Domain Events
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
      verboseMemoryLeak: false,
    }),

    // Modules internes
    DatabaseModule,
    CommonModule,

    // Modules métier
    AppInfoModule,
    HealthModule,
    MetricsModule,
    ObservabilityModule,
    EmailModule,
    ReportsModule,
    AuthModule,
    DepartmentsModule,
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
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
  controllers: [],
})
export class AppModule {}
