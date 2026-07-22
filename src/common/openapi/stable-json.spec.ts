import { stableJson } from './stable-json';

describe('stableJson', () => {
  it('trie récursivement les clés sans réordonner les tableaux', () => {
    const value = { z: 1, a: { y: 2, b: 3 }, list: [{ z: 4, a: 5 }, 6] };
    expect(stableJson(value)).toBe('{"a":{"b":3,"y":2},"list":[{"a":5,"z":4},6],"z":1}\n');
  });
});
