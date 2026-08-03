type CorsCallback = (error: Error | null, allow?: boolean) => void;

/** Préfiltre statique distinct du CORS interne; le tenant est ensuite contrôlé après authentification. */
export function publicWebsocketCorsOrigin(origin: string | undefined, callback: CorsCallback): void {
  if (isPublicWebsocketOriginAllowed(origin)) callback(null, true);
  else callback(new Error('Origine WebSocket publique non autorisée.'));
}

export function isPublicWebsocketOriginAllowed(origin: string | undefined): boolean {
  const configured = process.env['PUBLIC_SUPPORT_ORIGINS'];
  if (!configured && process.env['NODE_ENV'] === 'production') return false;
  const allowed = (configured || 'http://localhost:3005')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== '*');
  return Boolean(origin && allowed.includes(origin));
}
