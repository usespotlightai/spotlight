import type { Integration } from '@integrations/domain/entities/integration.entity';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface State {
  readonly teamId: TeamId;
  readonly source: SourceKey;
  readonly document: DefinitionDocument;
  readonly version: number;
}

interface Compiled {
  readonly integration: Integration;
  readonly document: DefinitionDocument;
}

const SOURCE_FIELD = 'integration';

const guardDescribes = (compiled: Compiled): void => {
  const source = compiled.integration.source.value;

  if (!compiled.document.says(SOURCE_FIELD, source)) {
    throw new InvalidIntegrationError(
      source,
      'was compiled from a definition of another host',
    );
  }
};

export class IntegrationDefinition {
  private constructor(private readonly state: State) {}

  static define(input: Compiled & { teamId: TeamId }): IntegrationDefinition {
    guardDescribes(input);

    return new IntegrationDefinition({
      teamId: input.teamId,
      source: input.integration.source,
      document: input.document,
      version: 0,
    });
  }

  static rehydrate(input: State): IntegrationDefinition {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'integration definition',
        'was kept without a version',
      );
    }

    if (!input.document.says(SOURCE_FIELD, input.source.value)) {
      throw new InconsistentStateError(
        'integration definition',
        'was kept under a host it does not define',
      );
    }

    return new IntegrationDefinition(input);
  }

  redefinedAs(compiled: Compiled): IntegrationDefinition {
    guardDescribes(compiled);

    if (!compiled.integration.source.equals(this.source)) {
      throw new InvalidIntegrationError(
        compiled.integration.source.value,
        `cannot replace the definition of ${this.source.value}`,
      );
    }

    return new IntegrationDefinition({
      ...this.state,
      document: compiled.document,
    });
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get source(): SourceKey {
    return this.state.source;
  }

  get document(): DefinitionDocument {
    return this.state.document;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }
}
