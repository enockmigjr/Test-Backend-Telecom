import { Test } from '@nestjs/testing';
import { PublicSupportConfigService } from '../../../config/public-support.config';
import { DrizzleProvider } from '../../../database/drizzle.provider';
import type { PublicPrincipal } from '../../external-identity/interfaces/public-principal.interface';
import { BOT_PROVIDER, type AiProvider, type BotCompletionResult } from '../interfaces/ai-provider.interface';
import { SupportBotService } from './support-bot.service';
import { ToolPolicyService } from './tool-policy.service';

describe('SupportBotService (repli formulaire)', () => {
  const principal: PublicPrincipal = {
    kind: 'PUBLIC',
    sub: 'requester-1',
    externalRequesterId: 'requester-1',
    supportIntegrationId: 'integration-1',
    jti: 'session-1',
  };
  const conversation = { id: 'conversation-1', supportIntegrationId: 'integration-1', status: 'OPEN' };

  function drizzleMock(rowSets: readonly unknown[][]) {
    let call = 0;
    const select = jest.fn(() => ({
      from: jest.fn(() => ({
        where: jest.fn(() => {
          const rows = rowSets[Math.min(call++, rowSets.length - 1)] ?? [];
          const result = Promise.resolve(rows);
          const query = {
            orderBy: () => query,
            limit: () => result,
            then: (onFulfilled: (value: unknown) => unknown, onRejected: (error: unknown) => unknown) =>
              result.then(onFulfilled, onRejected),
          };
          return query;
        }),
      })),
    }));
    const insert = jest.fn(() => ({ values: jest.fn(async () => undefined) }));
    return { db: { select, insert }, insert };
  }

  const config = {
    botMaxTokens: 800,
    botTimeoutMs: 20000,
    botPromptVersion: 'test-v1',
    botDailyBudget: 200,
    botCircuitOpenAfter: 2,
    botCircuitOpenMs: 600_000,
  };

  async function buildService(options: { readonly provider?: AiProvider; readonly features: Record<string, boolean>; readonly rowSets?: unknown[][] }) {
    const drizzle = drizzleMock(options.rowSets ?? [[conversation], [{ features: options.features }]]);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SupportBotService,
        {
          provide: DrizzleProvider,
          useValue: { db: drizzle.db, runInTransaction: (callback: () => unknown) => callback() },
        },
        { provide: PublicSupportConfigService, useValue: config },
        { provide: ToolPolicyService, useValue: { definitions: jest.fn(() => []), execute: jest.fn() } },
        ...(options.provider ? [{ provide: BOT_PROVIDER, useValue: options.provider }] : []),
      ],
    }).compile();
    return { service: moduleRef.get(SupportBotService), insert: drizzle.insert };
  }

  it('reste en mode disabled tant que la feature bot est inactive', async () => {
    const { service, insert } = await buildService({ features: { bot: false } });
    const result = await service.reply(principal, 'conversation-1', 'Ma ligne coupe.');
    expect(result.data.mode).toBe('disabled');
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('reste en mode disabled quand aucun fournisseur n est configure', async () => {
    const { service, insert } = await buildService({ features: { bot: true } });
    const result = await service.reply(principal, 'conversation-1', 'Ma ligne coupe.');
    expect(result.data.mode).toBe('disabled');
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('bascule en disabled quand le budget quotidien est atteint', async () => {
    const provider: AiProvider = { name: 'test', complete: jest.fn() };
    const { service, insert } = await buildService({
      features: { bot: true },
      provider,
      rowSets: [
        [conversation],
        [{ features: { bot: true }, quotaPolicy: { botRequestsPerDay: 2 } }],
        [{ total: 2 }],
      ],
    });
    const result = await service.reply(principal, 'conversation-1', 'Ma ligne coupe.');
    expect(result.data.mode).toBe('disabled');
    expect(provider.complete).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('bascule en unavailable quand le fournisseur echoue', async () => {
    const failing: AiProvider = {
      name: 'test',
      complete: jest.fn(async () => {
        throw new Error('PROVIDER_TIMEOUT');
      }),
    };
    const { service, insert } = await buildService({ features: { bot: true }, provider: failing });
    const result = await service.reply(principal, 'conversation-1', 'Ma ligne coupe.');
    expect(result.data.mode).toBe('unavailable');
    expect(result.data.suggestedActions).toContain('open_form');
    expect(insert).toHaveBeenCalledTimes(2);
  });

  it('ouvre le circuit apres echecs repetes puis repond sans appeler le fournisseur', async () => {
    const previous = process.env['PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_AFTER'];
    process.env['PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_AFTER'] = '2';
    const failing: AiProvider = {
      name: 'test',
      complete: jest.fn(async () => {
        throw new Error('PROVIDER_TIMEOUT');
      }),
    };
    const rowSets = Array.from({ length: 12 }, (_, index) => {
      switch (index % 4) {
        case 0:
          return [conversation];
        case 1:
          return [{ features: { bot: true } }];
        case 2:
          return [{ total: 0 }];
        default:
          return [];
      }
    });
    const { service } = await buildService({ features: { bot: true }, provider: failing, rowSets });
    await service.reply(principal, 'conversation-1', 'Premier essai.');
    await service.reply(principal, 'conversation-1', 'Deuxieme essai.');
    const circuits = (service as unknown as { circuits: Map<string, { failures: number; openedAt: number }> }).circuits;
    expect(circuits.size).toBe(1);
    expect(circuits.get('integration-1')?.openedAt).toBeGreaterThan(0);
    const third = await service.reply(principal, 'conversation-1', 'Troisieme essai.');
    expect(third.data.mode).toBe('unavailable');
    expect(failing.complete).toHaveBeenCalledTimes(2);
    if (previous === undefined) delete process.env['PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_AFTER'];
    else process.env['PUBLIC_SUPPORT_BOT_CIRCUIT_OPEN_AFTER'] = previous;
  });

  it('persiste la reponse avec ses metadonnees quand le fournisseur repond et referme le circuit', async () => {
    const result: BotCompletionResult = {
      content: 'Vérifiez votre routeur.',
      toolCalls: [],
      model: 'test-model',
      usage: { inputTokens: 10, outputTokens: 5 },
      confidence: 0.9,
    };
    const provider: AiProvider = { name: 'test', complete: jest.fn(async () => result) };
    const { service } = await buildService({ features: { bot: true }, provider });
    const reply = await service.reply(principal, 'conversation-1', 'Ma ligne coupe.');
    expect(reply.data.mode).toBe('reply');
    expect(reply.data.reply).toContain('routeur');
  });
});
