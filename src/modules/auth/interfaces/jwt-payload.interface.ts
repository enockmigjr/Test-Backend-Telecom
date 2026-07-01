/**
 * Payload du JWT Access Token tel que retourné par JwtStrategy.validate().
 * - `sub` : UUID de l'utilisateur (champ standard JWT, présent dans le token signé)
 * - `id` : alias de `sub`, ajouté par validate() pour la commodité des contrôleurs
 */
export interface JwtPayload {
  sub: string;
  /** Alias de `sub`, peuplé par JwtStrategy.validate(). Préférer `sub` pour le token signé. */
  id?: string;
  email: string;
  role: string;
  departmentId: string;
  jti: string;
}
