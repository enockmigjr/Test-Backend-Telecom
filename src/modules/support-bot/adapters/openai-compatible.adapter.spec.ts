import { OpenAiCompatibleAdapter } from './openai-compatible.adapter';

describe('OpenAiCompatibleAdapter', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
  }

  it('construit la requête et parse contenu, outils et usage', async () => {
    const fetchMock = jest.fn(async () =>
      jsonResponse({
        model: 'gpt-test',
        choices: [
          {
            message: {
              content: 'Vérifiez votre routeur.',
              tool_calls: [
                { id: 'call-1', type: 'function', function: { name: 'knowledge_search', arguments: '{"query":"coupure"}' } },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 12, completion_tokens: 6 },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const adapter = new OpenAiCompatibleAdapter('https://api.example.com/v1/', 'secret', 'gpt-test');
    const result = await adapter.complete({
      systemPrompt: 'Assistant support.',
      messages: [{ role: 'user', content: 'Ma ligne coupe.' }],
      tools: [{ name: 'knowledge_search', description: 'Recherche', parameters: { type: 'object' } }],
      maxTokens: 800,
      timeoutMs: 5000,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(init.headers).toMatchObject({ authorization: 'Bearer secret' });
    const body = JSON.parse(String(init.body)) as { model: string; messages: unknown[]; tools: unknown[] };
    expect(body.model).toBe('gpt-test');
    expect(body.messages).toHaveLength(2);
    expect(body.tools).toHaveLength(1);
    expect(result.content).toBe('Vérifiez votre routeur.');
    expect(result.toolCalls[0]?.name).toBe('knowledge_search');
    expect(result.toolCalls[0]?.arguments).toEqual({ query: 'coupure' });
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 6 });
  });

  it('remonte une erreur HTTP explicite', async () => {
    globalThis.fetch = jest.fn(async () => jsonResponse({ error: 'boom' }, 500)) as unknown as typeof fetch;
    const adapter = new OpenAiCompatibleAdapter('https://api.example.com/v1', 'secret', 'gpt-test');
    await expect(
      adapter.complete({
        systemPrompt: '',
        messages: [{ role: 'user', content: 'x' }],
        tools: [],
        maxTokens: 100,
        timeoutMs: 5000,
      }),
    ).rejects.toThrow('PROVIDER_HTTP_500');
  });
});
