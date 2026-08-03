import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Socket } from 'net';
import { AntivirusScanner, AntivirusScanResult } from './antivirus-scanner.interface';

const CHUNK_SIZE = 64 * 1024;

@Injectable()
export class ClamavScannerService implements AntivirusScanner {
  private readonly host = process.env['CLAMAV_HOST'] || 'localhost';
  private readonly port = Number(process.env['CLAMAV_PORT'] || 3310);
  private readonly timeoutMs = Number(process.env['CLAMAV_TIMEOUT_MS'] || 10_000);
  private readonly maxSize = Number(process.env['CLAMAV_MAX_FILE_SIZE'] || 10 * 1024 * 1024);

  async scan(buffer: Buffer): Promise<AntivirusScanResult> {
    if (buffer.length > this.maxSize) throw new ServiceUnavailableException('Fichier trop volumineux pour le scanner.');
    const response = await this.command('zINSTREAM\0', buffer);
    if (response.endsWith('OK')) return { clean: true };
    const match = response.match(/: (.+) FOUND$/);
    if (match?.[1]) return { clean: false, signature: match[1] };
    throw new ServiceUnavailableException('Réponse antivirus invalide.');
  }

  async health(): Promise<boolean> {
    try {
      return (await this.command('zPING\0')).trim() === 'PONG';
    } catch {
      return false;
    }
  }

  private command(command: string, payload?: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      const chunks: Buffer[] = [];
      const fail = (error: Error) => {
        socket.destroy();
        reject(error);
      };
      socket.setTimeout(this.timeoutMs, () => fail(new Error('CLAMAV_TIMEOUT')));
      socket.once('error', fail);
      socket.on('data', (chunk: Buffer) => chunks.push(chunk));
      socket.once('end', () => resolve(Buffer.concat(chunks).toString('utf8').replace(/\0+$/, '').trim()));
      socket.connect(this.port, this.host, () => {
        socket.write(command);
        if (payload) this.writeStream(socket, payload);
        else socket.end();
      });
    });
  }

  private writeStream(socket: Socket, payload: Buffer): void {
    for (let offset = 0; offset < payload.length; offset += CHUNK_SIZE) {
      const chunk = payload.subarray(offset, Math.min(offset + CHUNK_SIZE, payload.length));
      const length = Buffer.allocUnsafe(4);
      length.writeUInt32BE(chunk.length);
      socket.write(length);
      socket.write(chunk);
    }
    socket.end(Buffer.alloc(4));
  }
}
