import { publicWebsocketCorsOrigin } from './public-websocket-cors';

describe('publicWebsocketCorsOrigin', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PUBLIC_SUPPORT_ORIGINS: 'https://portal.example.test, https://widget.example.test',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each(['https://portal.example.test', 'https://widget.example.test'])(
    'accepte une origine configuree: %s',
    (origin) => {
      const callback = jest.fn();
      publicWebsocketCorsOrigin(origin, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    },
  );

  it.each([undefined, 'https://evil.example.test'])('rejette une origine absente ou hostile', (origin) => {
    const callback = jest.fn();
    publicWebsocketCorsOrigin(origin, callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('ignore le joker pour ne jamais autoriser toutes les origines', () => {
    process.env['PUBLIC_SUPPORT_ORIGINS'] = '*';
    const callback = jest.fn();
    publicWebsocketCorsOrigin('https://portal.example.test', callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });

  it('refuse une configuration implicite en production', () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['PUBLIC_SUPPORT_ORIGINS'];
    const callback = jest.fn();
    publicWebsocketCorsOrigin('http://localhost:3005', callback);
    expect(callback.mock.calls[0]?.[0]).toBeInstanceOf(Error);
  });
});
