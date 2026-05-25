import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';

export interface AiProviderRequest {
  systemPrompt: string;
  userPayloadText: string;
  modelName: string;
  timeoutMs: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
}

export interface AiProviderResult {
  rawText: string;
  rawResponse: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

@Injectable()
export class VolcengineArkProvider {
  async generateText(
    request: AiProviderRequest,
    auth: { apiKey: string; baseUrl: string },
  ): Promise<AiProviderResult> {
    const client = new OpenAI({
      apiKey: auth.apiKey,
      baseURL: auth.baseUrl,
      timeout: request.timeoutMs,
      maxRetries: 0,
    });

    const response = await client.responses.create({
      model: request.modelName,
      input: [
        {
          role: 'system',
          content: [{ type: 'input_text', text: request.systemPrompt }],
        },
        {
          role: 'user',
          content: [{ type: 'input_text', text: request.userPayloadText }],
        },
      ],
      ...(request.maxOutputTokens ? { max_output_tokens: request.maxOutputTokens } : {}),
      ...(request.temperature !== undefined ? { temperature: request.temperature } : {}),
      ...(request.topP !== undefined ? { top_p: request.topP } : {}),
    });

    return {
      rawText: this.extractText(response),
      rawResponse: response,
      usage: {
        inputTokens: Number((response as { usage?: { input_tokens?: number } })?.usage?.input_tokens ?? 0),
        outputTokens: Number((response as { usage?: { output_tokens?: number } })?.usage?.output_tokens ?? 0),
      },
    };
  }

  private extractText(response: unknown): string {
    const candidate = response as {
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string; output_text?: string; content?: string }> ; text?: string; output_text?: string }>;
    };

    if (typeof candidate.output_text === 'string' && candidate.output_text.trim()) {
      return candidate.output_text.trim();
    }

    const output = Array.isArray(candidate.output) ? candidate.output : [];
    const chunks: string[] = [];
    for (const item of output) {
      if (typeof item?.text === 'string' && item.text.trim()) {
        chunks.push(item.text);
      }
      if (typeof item?.output_text === 'string' && item.output_text.trim()) {
        chunks.push(item.output_text);
      }
      const content = Array.isArray(item?.content) ? item.content : [];
      for (const block of content) {
        if (typeof block?.text === 'string' && block.text.trim()) {
          chunks.push(block.text);
        }
        if (typeof block?.output_text === 'string' && block.output_text.trim()) {
          chunks.push(block.output_text);
        }
        if (typeof block?.content === 'string' && block.content.trim()) {
          chunks.push(block.content);
        }
      }
    }

    const merged = chunks.join('').trim();
    if (merged) {
      return merged;
    }

    const fallback = this.collectTextChunks(response).join('').trim();
    if (fallback) {
      return fallback;
    }

    throw new Error('Ark 响应中未解析到文本内容');
  }

  private collectTextChunks(value: unknown, depth = 0): string[] {
    if (depth > 6 || value === null || value === undefined) {
      return [];
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      return normalized ? [normalized] : [];
    }
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.collectTextChunks(item, depth + 1));
    }
    if (typeof value !== 'object') {
      return [];
    }

    const record = value as Record<string, unknown>;
    const picked: string[] = [];
    for (const [key, nested] of Object.entries(record)) {
      if (key === 'text' || key === 'output_text' || key === 'content') {
        picked.push(...this.collectTextChunks(nested, depth + 1));
      }
    }
    return picked;
  }
}
