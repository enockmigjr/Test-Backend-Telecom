import type {
  AiProvider,
  BotCompletionInput,
  BotCompletionResult,
  BotMessage,
  BotToolCall,
  BotToolDefinition,
} from '../interfaces/ai-provider.interface';

interface OpenAiChatMessage {
  role: string;
  content: string | null;
  tool_calls?: readonly OpenAiToolCall[];
  tool_call_id?: string;
}

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface OpenAiUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
}

interface OpenAiResponse {
  choices?: readonly { message?: OpenAiChatMessage }[];
  usage?: OpenAiUsage;
  model?: string;
}

/** Adaptateur réel pour tout fournisseur compatible OpenAI (actif uniquement si configuré). */
export class OpenAiCompatibleAdapter implements AiProvider {
  readonly name = 'openai-compatible';

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
  ) {}

  async complete(input: BotCompletionInput): Promise<BotCompletionResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            ...(input.systemPrompt ? [{ role: 'system', content: input.systemPrompt }] : []),
            ...input.messages.map(toOpenAiMessage),
          ],
          ...(input.tools.length > 0 ? { tools: input.tools.map(toOpenAiTool) } : {}),
          max_tokens: input.maxTokens,
          temperature: 0.2,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`PROVIDER_HTTP_${response.status}`);
      const payload = (await response.json()) as OpenAiResponse;
      const message = payload.choices?.[0]?.message;
      if (!message) throw new Error('PROVIDER_EMPTY_RESPONSE');
      const toolCalls = (message.tool_calls ?? []).map(parseToolCall);
      return {
        content: message.content,
        toolCalls,
        model: payload.model ?? this.model,
        usage: payload.usage
          ? {
              inputTokens: payload.usage.prompt_tokens ?? 0,
              outputTokens: payload.usage.completion_tokens ?? 0,
            }
          : undefined,
        confidence: message.content && message.content.length > 0 ? 0.8 : 0.3,
      };
    } catch (error: unknown) {
      if (controller.signal.aborted) throw new Error('PROVIDER_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }
}

function toOpenAiMessage(message: BotMessage): OpenAiChatMessage {
  if (message.role === 'tool') {
    return { role: 'tool', content: message.content, tool_call_id: message.toolCallId };
  }
  return { role: message.role, content: message.content };
}

function toOpenAiTool(tool: BotToolDefinition) {
  return { type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } };
}

function parseToolCall(call: OpenAiToolCall): BotToolCall {
  let argumentsValue: Readonly<Record<string, unknown>> = {};
  try {
    const parsed: unknown = JSON.parse(call.function.arguments);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      argumentsValue = parsed as Record<string, unknown>;
    }
  } catch {
    argumentsValue = {};
  }
  return { id: call.id, name: call.function.name, arguments: argumentsValue };
}
