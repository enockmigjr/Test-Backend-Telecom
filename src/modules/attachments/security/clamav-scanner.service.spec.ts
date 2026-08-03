import { ServiceUnavailableException } from '@nestjs/common';
import { AddressInfo, createServer, Server } from 'net';
import { ClamavScannerService } from './clamav-scanner.service';

interface CapturedCommand {
  readonly command: 'PING' | 'INSTREAM';
  readonly payload: Buffer;
  readonly chunkSizes: readonly number[];
}

interface FakeClamServer {
  readonly port: number;
  readonly captured: CapturedCommand[];
  close(): Promise<void>;
}

async function startServer(response: string): Promise<FakeClamServer> {
  const captured: CapturedCommand[] = [];
  const server: Server = createServer((socket) => {
    let received = Buffer.alloc(0);
    let replied = false;
    socket.on('data', (chunk: Buffer) => {
      received = Buffer.concat([received, chunk]);
      if (replied) return;
      if (received.equals(Buffer.from('zPING\0'))) {
        replied = true;
        captured.push({ command: 'PING', payload: Buffer.alloc(0), chunkSizes: [] });
        socket.end(`${response}\0`);
        return;
      }
      const parsed = parseInstream(received);
      if (parsed) {
        replied = true;
        captured.push({ command: 'INSTREAM', ...parsed });
        socket.end(`${response}\0`);
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  return {
    port: address.port,
    captured,
    close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function parseInstream(buffer: Buffer): { payload: Buffer; chunkSizes: readonly number[] } | null {
  const prefix = Buffer.from('zINSTREAM\0');
  if (buffer.length < prefix.length || !buffer.subarray(0, prefix.length).equals(prefix)) return null;
  const chunks: Buffer[] = [];
  const chunkSizes: number[] = [];
  let offset = prefix.length;
  while (buffer.length >= offset + 4) {
    const length = buffer.readUInt32BE(offset);
    offset += 4;
    if (length === 0) return { payload: Buffer.concat(chunks), chunkSizes };
    if (buffer.length < offset + length) return null;
    chunks.push(buffer.subarray(offset, offset + length));
    chunkSizes.push(length);
    offset += length;
  }
  return null;
}

describe('ClamavScannerService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CLAMAV_HOST: '127.0.0.1', CLAMAV_TIMEOUT_MS: '1000' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('encode INSTREAM en chunks big-endian et reconnait un fichier sain', async () => {
    const fake = await startServer('stream: OK');
    process.env['CLAMAV_PORT'] = String(fake.port);
    const payload = Buffer.alloc(64 * 1024 + 10, 0x41);
    try {
      await expect(new ClamavScannerService().scan(payload)).resolves.toEqual({ clean: true });
      expect(fake.captured).toEqual([{ command: 'INSTREAM', payload, chunkSizes: [64 * 1024, 10] }]);
    } finally {
      await fake.close();
    }
  });

  it('extrait la signature malware retournee par ClamAV', async () => {
    const fake = await startServer('stream: Eicar-Test-Signature FOUND');
    process.env['CLAMAV_PORT'] = String(fake.port);
    try {
      await expect(new ClamavScannerService().scan(Buffer.from('infected'))).resolves.toEqual({
        clean: false,
        signature: 'Eicar-Test-Signature',
      });
    } finally {
      await fake.close();
    }
  });

  it('utilise PING pour le healthcheck et degrade une reponse inattendue', async () => {
    const healthy = await startServer('PONG');
    process.env['CLAMAV_PORT'] = String(healthy.port);
    try {
      await expect(new ClamavScannerService().health()).resolves.toBe(true);
      expect(healthy.captured[0]?.command).toBe('PING');
    } finally {
      await healthy.close();
    }

    const invalid = await startServer('UNEXPECTED');
    process.env['CLAMAV_PORT'] = String(invalid.port);
    try {
      await expect(new ClamavScannerService().scan(Buffer.from('file'))).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    } finally {
      await invalid.close();
    }
  });

  it('refuse localement un fichier au-dessus de la limite sans ouvrir de connexion', async () => {
    process.env['CLAMAV_MAX_FILE_SIZE'] = '3';
    await expect(new ClamavScannerService().scan(Buffer.alloc(4))).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
