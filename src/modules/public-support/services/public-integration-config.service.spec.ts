import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import { PublicIntegrationConfigService } from './public-integration-config.service';

function selectQuery(result: readonly unknown[]) {
  const builder = {
    from: jest.fn(),
    where: jest.fn(),
    limit: jest.fn().mockResolvedValue(result),
  };
  builder.from.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  return builder;
}

describe('PublicIntegrationConfigService', () => {
  const select = jest.fn();
  let service: PublicIntegrationConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [PublicIntegrationConfigService, { provide: DrizzleProvider, useValue: { db: { select } } }],
    }).compile();
    service = moduleRef.get(PublicIntegrationConfigService);
  });

  it('ne publie que les options visuelles et fonctionnalites explicitement autorisees', async () => {
    select.mockReturnValue(
      selectQuery([
        {
          name: 'PhotoVault',
          allowedOrigins: ['https://photos.example'],
          appearance: {
            supportName: '  Assistance PhotoVault  ',
            welcomeTitle: 'x'.repeat(121),
            welcomeMessage: '<script>alert(1)</script>',
            primaryColor: '#aa00ff',
            accentColor: 'red',
            logoUrl: 'https://cdn.example/logo.svg',
            privateToken: 'secret',
          },
          features: { publicAttachments: true, publicRealtime: false, publicBot: true, adminConsole: true },
        },
      ]),
    );

    await expect(service.get('photo-vault', 'https://photos.example')).resolves.toEqual({
      data: {
        name: 'PhotoVault',
        frameAllowed: true,
        appearance: {
          supportName: 'Assistance PhotoVault',
          welcomeTitle: undefined,
          welcomeMessage: '<script>alert(1)</script>',
          primaryColor: '#AA00FF',
          accentColor: undefined,
          logoUrl: 'https://cdn.example/logo.svg',
        },
        features: { publicAttachments: true, publicRealtime: false, publicBot: true },
      },
    });
  });

  it.each(['integration-inactive', 'integration-autre-tenant'])(
    'masque %s comme une integration indisponible',
    async (integrationKey) => {
      select.mockReturnValue(selectQuery([]));

      await expect(service.get(integrationKey)).rejects.toBeInstanceOf(NotFoundException);
    },
  );
});
