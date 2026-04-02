import { Injectable } from '@nestjs/common';

export type AnthropicModelChoice = 'haiku' | 'sonnet' | 'opus';

function modelId(choice: AnthropicModelChoice): string {
  // Fallback si no podemos listar modelos disponibles.
  if (choice === 'sonnet') return 'claude-3-sonnet-20240229';
  if (choice === 'opus') return 'claude-3-opus-20240229';
  return 'claude-3-haiku-20240307';
}

@Injectable()
export class AnthropicClientService {
  private async resolveAvailableModelId(apiKey: string, choice: AnthropicModelChoice): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=200', {
      method: 'GET',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
    });
    if (!res.ok) {
      throw new Error(`models list ${res.status}`);
    }
    const data = (await res.json()) as { data?: { id?: string }[] };
    const models = (data.data ?? []).map((m) => String(m.id ?? '')).filter(Boolean);
    const want = choice;
    const match = models.find((id) => id.toLowerCase().includes(want));
    if (match) return match;
    // Último recurso: usar fallback fijo
    return modelId(choice);
  }

  async extractJson(params: {
    apiKey: string;
    model: AnthropicModelChoice;
    prompt: string;
    maxTokens?: number;
  }): Promise<{ text: string; modelId: string }> {
    let id = modelId(params.model);
    try {
      id = await this.resolveAvailableModelId(params.apiKey, params.model);
    } catch {
      // mantener fallback
    }
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': params.apiKey,
      },
      body: JSON.stringify({
        model: id,
        max_tokens: params.maxTokens ?? 1200,
        temperature: 0,
        messages: [{ role: 'user', content: params.prompt }],
      }),
    });
    const bodyText = await res.text();
    if (!res.ok) {
      const snippet = bodyText.length > 400 ? `${bodyText.slice(0, 400)}…` : bodyText;
      throw new Error(`Anthropic ${res.status}: ${snippet}`);
    }
    const json = JSON.parse(bodyText) as {
      content?: { type?: string; text?: string }[];
    };
    const text =
      json.content?.find((c) => c.type === 'text')?.text ??
      json.content?.[0]?.text ??
      '';
    return { text: String(text), modelId: id };
  }
}

