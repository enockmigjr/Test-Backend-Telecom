type CorsCallback = (error: Error | null, allow?: boolean) => void;

/** Préfiltre statique distinct du CORS interne; le tenant est ensuite contrôlé après authentification. */
export function publicWebsocketCorsOrigin(origin: string | undefined, callback: CorsCallback): void {
  const configured = process.env['PUBLIC_SUPPORT_ORIGINS'];
  if (!configured && process.env['NODE_ENV'] === 'production') {
    callback(new Error('PUBLIC_SUPPORT_ORIGINS doit être défini en production.'));
    return;
  }
  const allowed = (configured || 'http://localhost:3005')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== '*');
  if (origin && allowed.includes(origin)) callback(null, true);
  else callback(new Error('Origine WebSocket publique non autorisée.'));
}
