export type BotRole = 'system' | 'user' | 'assistant' | 'tool';

export interface BotMessage {
  readonly role: BotRole;
  readonly content: string;
  readonly toolCallId?: string;
}

export interface BotToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly parameters: Readonly<Record<string, unknown>>;
}

export interface BotToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

export interface BotUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
}

export interface BotCompletionResult {
  readonly content: string | null;
  readonly toolCalls: readonly BotToolCall[];
  readonly model: string;
  readonly usage?: BotUsage;
  /** Confiance estimée du fournisseur entre 0 et 1 (facultative). */
  readonly confidence?: number;
}

export interface BotCompletionInput {
  readonly systemPrompt: string;
  readonly messages: readonly BotMessage[];
  readonly tools: readonly BotToolDefinition[];
  readonly maxTokens: number;
  readonly timeoutMs: number;
}

/** Contrat unique pour un fournisseur IA réel (aucun fournisseur factice en production). */
export interface AiProvider {
  readonly name: string;
  complete(input: BotCompletionInput): Promise<BotCompletionResult>;
}

export const BOT_PROVIDER = Symbol('BOT_PROVIDER');
