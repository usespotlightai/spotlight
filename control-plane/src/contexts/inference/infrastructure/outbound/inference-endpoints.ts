import type { InferenceResolutionPort } from '@inference/application/ports/inference-resolution.port';
import { INFERENCE_KEY_SECRET } from '@inference/application/rendering/inference-problems';
import type { InferenceEndpointRepository } from '@inference/domain/repositories/inference-endpoint.repository';
import type { ModelEndpoint } from '@platform/llm/chat-completions';
import { NO_PRICES, type ModelPrices } from '@platform/llm/model-prices';
import type { WorkspaceSecretsPort } from '@secrets/application/ports/workspace-secrets.port';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const FRESH_FOR_MS = 30_000;

interface Held {
  readonly endpoint: Promise<ModelEndpoint | null>;
  readonly until: number;
}

export class InferenceEndpoints implements InferenceResolutionPort {
  private readonly held = new Map<string, Held>();

  constructor(
    private readonly endpoints: InferenceEndpointRepository,
    private readonly secrets: WorkspaceSecretsPort,
    private readonly prices: ModelPrices = NO_PRICES,
    private readonly now: () => number = () => performance.now(),
    private readonly freshForMs = FRESH_FOR_MS,
  ) {}

  of(workspaceId: string): Promise<ModelEndpoint | null> {
    const held = this.held.get(workspaceId);

    if (held && held.until > this.now()) {
      return held.endpoint;
    }

    const endpoint = this.read(workspaceId);
    this.held.set(workspaceId, {
      endpoint,
      until: this.now() + this.freshForMs,
    });
    endpoint.catch(() => {
      if (this.held.get(workspaceId)?.endpoint === endpoint) {
        this.held.delete(workspaceId);
      }
    });

    return endpoint;
  }

  forget(workspaceId: string): void {
    this.held.delete(workspaceId);
  }

  private async read(workspaceId: string): Promise<ModelEndpoint | null> {
    const found = await this.endpoints.ofWorkspace(WorkspaceId.of(workspaceId));

    if (!found) {
      return null;
    }

    const apiKey = found.hasApiKey
      ? await this.secrets.reveal(workspaceId, INFERENCE_KEY_SECRET)
      : null;

    return {
      baseUrl: found.definition.baseUrl.value,
      apiKey: apiKey ?? undefined,
      model: found.definition.model.value,
      supportsReasoningEffort: found.definition.supportsReasoningEffort,
      prices: this.prices,
    };
  }
}
