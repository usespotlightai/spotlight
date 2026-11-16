import type { InferenceEndpoints } from '@inference/infrastructure/outbound/inference-endpoints';
import type { InferenceTransport } from '@inference/infrastructure/outbound/inference-transport';
import { NoInferenceEndpointError } from '@shared-kernel/application/errors/no-inference-endpoint.error';
import type {
  InferenceCallsPort,
  InferenceModel,
  JsonRequest,
  StructuredCompletion,
} from '@shared-kernel/application/ports/inference-calls.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export class InferenceCalls implements InferenceCallsPort {
  constructor(
    private readonly endpoints: InferenceEndpoints,
    private readonly transport: InferenceTransport,
    private readonly logger: LoggerPort,
  ) {}

  endpointOf(workspaceId: string): Promise<InferenceModel | null> {
    return this.endpoints.of(workspaceId);
  }

  async availableTo(workspaceId: string): Promise<boolean> {
    const endpoint = await this.endpoints.of(workspaceId);

    if (!endpoint) {
      this.logger.debug(
        { workspaceId },
        'An inference feature is off because the workspace has no inference endpoint',
      );
    }

    return endpoint !== null;
  }

  async json<T>(
    workspaceId: string,
    request: JsonRequest<T>,
  ): Promise<StructuredCompletion<T>> {
    const endpoint = await this.endpoints.of(workspaceId);

    if (!endpoint) {
      throw new NoInferenceEndpointError();
    }

    return this.transport.call(workspaceId, endpoint, request);
  }
}
