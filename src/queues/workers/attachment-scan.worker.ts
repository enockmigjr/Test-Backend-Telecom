import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Job, Worker } from 'bullmq';
import { redisConfig } from '../../common/providers/redis.config';
import { AttachmentScanService } from '../../modules/attachments/security/attachment-scan.service';
import { ATTACHMENT_SCAN_QUEUE } from '../queues.module';

interface AttachmentScanJob {
  readonly attachmentId: string;
}

@Injectable()
export class AttachmentScanWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AttachmentScanWorker.name);
  private worker?: Worker<AttachmentScanJob>;

  constructor(private readonly scans: AttachmentScanService) {}

  onModuleInit(): void {
    this.worker = new Worker<AttachmentScanJob>(
      ATTACHMENT_SCAN_QUEUE,
      async (job: Job<AttachmentScanJob>) => {
        const attempts = typeof job.opts.attempts === 'number' ? job.opts.attempts : 1;
        await this.scans.process(job.data.attachmentId, job.attemptsMade + 1 >= attempts);
      },
      {
        connection: { host: redisConfig.host, port: redisConfig.port, password: redisConfig.password || undefined },
        concurrency: 2,
      },
    );
    this.worker.on('failed', (job, error) =>
      this.logger.error(`Scan pièce jointe en échec: ${job?.id ?? 'inconnu'} (${errorCategory(error)})`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

function errorCategory(error: unknown): string {
  if (typeof error !== 'object' || error === null) return 'UnknownError';
  const name = 'name' in error && typeof error.name === 'string' ? error.name : 'Error';
  const code = 'code' in error && typeof error.code === 'string' ? error.code : undefined;
  return code ? `${name}:${code}` : name;
}
