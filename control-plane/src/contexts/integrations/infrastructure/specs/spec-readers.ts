import type { WorkspaceOutboundScopePort } from '@identity/application/ports/workspace-outbound-scope.port';
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
    private readonly scope: WorkspaceOutboundScopePort,
  ) {}

  async read(spec: ApiSpec, callAuth: CallAuth): Promise<SpecRead> {
    const reader = spec.kind === 'mcp' ? this.servers : this.documents;

    return this.scope.withinFresh(await callAuth.workspace(), () =>
      reader.read(spec, callAuth),
    );
  }
}
