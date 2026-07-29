/**
 * ============================================================================
 * FICHIER : src/websocket/websocket-cors.ts
 * RÔLE : Validateur strict d'origine CORS (Cross-Origin Resource Sharing) pour la passerelle WebSocket.
 * EXPLICATION :
 * Ce module protège le serveur WebSocket Socket.IO contre les attaques d'origines non autorisées (CSWSH) :
 * 1. Exige la présence de la variable d'environnement `CORS_ORIGIN` en production (interdit le joker `*`).
 * 2. Découpe et nettoie la liste des origines autorisées (ex: `http://localhost:5173,http://localhost:3000`).
 * 3. Valide dynamiquement l'en-tête `Origin` de la poignée de main (handshake) Socket.IO.
 * ============================================================================
 */

/** Type représentant le callback de validation CORS d'Express / Socket.IO. */
type CorsCallback = (error: Error | null, allow?: boolean) => void;

/**
 * Valide l'origine d'une tentative de connexion WebSocket.
 *
 * @param origin L'origine du navigateur client (ex: "http://localhost:5173").
 * @param callback Callback de réponse autorisant (`true`) ou rejetant (`Error`) la connexion.
 */
export function websocketCorsOrigin(origin: string | undefined, callback: CorsCallback): void {
  const configured = process.env['CORS_ORIGIN'];
  if (!configured && process.env['NODE_ENV'] === 'production') {
    callback(new Error('CORS_ORIGIN doit être défini en production.'));
    return;
  }

  // Extraction et assainissement des origines autorisées (exclusion explicite du joker '*')
  const allowedOrigins = (configured || 'http://localhost:3000')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0 && value !== '*');

  // Autoriser la connexion si l'origine figure dans la liste blanche
  if (origin && allowedOrigins.includes(origin)) {
    callback(null, true);
    return;
  }
  callback(new Error('Origine WebSocket non autorisée.'));
}
