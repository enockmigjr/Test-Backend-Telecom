type CorsCallback = (error: Error | null, allow?: boolean) => void;

export function websocketCorsOrigin(origin: string | undefined, callback: CorsCallback): void {
  const configured = process.env['CORS_ORIGIN'];
  if (!configured && process.env['NODE_ENV'] === 'production') {
    callback(new Error('CORS_ORIGIN doit etre defini en production.'));
    return;
  }

  const allowedOrigins = (configured || 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== '*');

  if (origin && allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Origine WebSocket non autorisee.'));
}
