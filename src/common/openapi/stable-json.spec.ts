/**
 * ============================================================================
 * FICHIER : src/common/openapi/stable-json.spec.ts
 * RÔLE : Suite de tests unitaires pour le composant stable-json.
 * EXPLICATION :
 * Ce fichier contient les tests automatisés validant le comportement et l'intégrité de stable-json.
 * 1. Vérifie le fonctionnement nominal et les cas d'erreur.
 * 2. Garantit qu'aucune régression n'est introduite lors des évolutions du code.
 * ============================================================================
 */

import { stableJson } from './stable-json';

describe('stableJson', () => {
  /** Test : trie récursivement les clés sans réordonner les tableaux */
  it('trie récursivement les clés sans réordonner les tableaux', () => {
    const value = { z: 1, a: { y: 2, b: 3 }, list: [{ z: 4, a: 5 }, 6] };
    expect(stableJson(value)).toBe('{"a":{"b":3,"y":2},"list":[{"a":5,"z":4},6],"z":1}\n');
  });
});
