import { errorCategory, isRecord, policyNumber, positiveNumber, splitEncrypted, stringArray } from './helpers';

describe('helpers communs', () => {
  describe('errorCategory', () => {
    it('catégorise une erreur avec code', () => {
      expect(errorCategory({ name: 'Error', code: 'ECONNREFUSED' })).toBe('Error:ECONNREFUSED');
    });

    it('retourne le nom seul sans code', () => {
      expect(errorCategory(new Error('boom'))).toBe('Error');
    });

    it('retourne UnknownError pour les non-objets', () => {
      expect(errorCategory('nope')).toBe('UnknownError');
      expect(errorCategory(null)).toBe('UnknownError');
    });
  });

  describe('isRecord', () => {
    it('accepte les objets et rejette null/tableaux/primitifs', () => {
      expect(isRecord({ a: 1 })).toBe(true);
      expect(isRecord([])).toBe(false);
      expect(isRecord(null)).toBe(false);
      expect(isRecord('x')).toBe(false);
    });
  });

  describe('policyNumber', () => {
    it('retourne la valeur si entier strictement positif', () => {
      expect(policyNumber({ limit: 5 }, 'limit', 1)).toBe(5);
    });

    it('retourne le fallback sinon (null, undefined, non entier, <= 0)', () => {
      expect(policyNumber(null, 'limit', 1)).toBe(1);
      expect(policyNumber(undefined, 'limit', 1)).toBe(1);
      expect(policyNumber({ limit: 0 }, 'limit', 1)).toBe(1);
      expect(policyNumber({ limit: '5' }, 'limit', 1)).toBe(1);
    });
  });

  describe('positiveNumber', () => {
    it('retourne la valeur si entier strictement positif, sinon fallback', () => {
      expect(positiveNumber(42, 1)).toBe(42);
      expect(positiveNumber('42', 1)).toBe(1);
      expect(positiveNumber(0, 1)).toBe(1);
    });
  });

  describe('stringArray', () => {
    it('ne conserve que les chaînes', () => {
      expect(stringArray(['a', 1, null, 'b'])).toEqual(['a', 'b']);
      expect(stringArray('nope')).toEqual([]);
    });
  });

  describe('splitEncrypted', () => {
    it('décompose version:encrypted', () => {
      expect(splitEncrypted('2:abc')).toEqual([2, 'abc']);
    });

    it('rejette les formats invalides', () => {
      expect(() => splitEncrypted('abc')).toThrow('CIPHERTEXT_INVALID');
      expect(() => splitEncrypted('0:abc')).toThrow('CIPHERTEXT_INVALID');
      expect(() => splitEncrypted('2:')).toThrow('CIPHERTEXT_INVALID');
    });
  });
});
