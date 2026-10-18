import type { CallAuth } from '@integrations/application/ports/integration-runtime.port';
import type {
  SpecRead,
  SpecReaderPort,
} from '@integrations/application/ports/spec-reader.port';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';

export class SpecReaders implements SpecReaderPort {
  constructor(
    private readonly documents: SpecReaderPort,
    private readonly servers: SpecReaderPort,
  ) {}

  read(spec: ApiSpec, callAuth: CallAuth): Promise<SpecRead> {
    return spec.kind === 'mcp'
      ? this.servers.read(spec, callAuth)
      : this.documents.read(spec, callAuth);
  }
}
