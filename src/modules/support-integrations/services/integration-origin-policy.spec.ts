import { BadRequestException } from '@nestjs/common';
import { normalizeExactOrigins } from './integration-origin-policy';

describe('normalizeExactOrigins', () => {
  it('accepte HTTPS exact et HTTP localhost', () => {
    expect(normalizeExactOrigins(['https://photos.example.com', 'http://localhost:3000'])).toEqual([
      'https://photos.example.com',
      'http://localhost:3000',
    ]);
  });

  it.each([
    [['http://photos.example.com']],
    [['https://photos.example.com/widget']],
    [['https://user:secret@photos.example.com']],
    [['https://photos.example.com', 'https://photos.example.com']],
  ])('refuse une origine non exacte ou dupliquée: %p', (origins) => {
    expect(() => normalizeExactOrigins(origins)).toThrow(BadRequestException);
  });
});
