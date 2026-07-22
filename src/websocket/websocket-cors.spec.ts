import { websocketCorsOrigin } from './websocket-cors';

describe('websocketCorsOrigin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test', CORS_ORIGIN: 'https://app.example.test' };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('accepte une origine explicitement configuree', () => {
    const callback = jest.fn();
    websocketCorsOrigin('https://app.example.test', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejette une origine hostile', () => {
    const callback = jest.fn();
    websocketCorsOrigin('https://evil.example', callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('rejette une connexion sans origine', () => {
    const callback = jest.fn();
    websocketCorsOrigin(undefined, callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('refuse de demarrer implicitement avec localhost en production', () => {
    delete process.env['CORS_ORIGIN'];
    process.env['NODE_ENV'] = 'production';
    const callback = jest.fn();
    websocketCorsOrigin('https://app.example.test', callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
