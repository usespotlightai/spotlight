import {
  type Fetch,
  type ModelEndpoint,
  requestJson,
} from '@platform/llm/chat-completions';
import { NoInferenceEndpointError } from '@shared-kernel/application/errors/no-inference-endpoint.error';
import type {
  InferenceCallsPort,
  JsonRequest,
  StructuredCompletion,
} from '@shared-kernel/application/ports/inference-calls.port';

export class FixedInferenceCalls implements InferenceCallsPort {
  constructor(
    private readonly endpoint: ModelEndpoint | null,
    private readonly fetch: Fetch = globalThis.fetch,
  ) {}

  async endpointOf(): Promise<ModelEndpoint | null> {
    return this.endpoint;
  }

  async availableTo(): Promise<boolean> {
    return this.endpoint !== null;
  }

  async json<T>(
    _workspaceId: string,
    request: JsonRequest<T>,
  ): Promise<StructuredCompletion<T>> {
    if (!this.endpoint) {
      throw new NoInferenceEndpointError();
    }

    return requestJson({
      ...request,
      endpoint: this.endpoint,
      fetch: this.fetch,
    });
  }
}
