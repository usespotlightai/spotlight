import type { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationDefined } from '@integrations/domain/events/integration-defined.event';
import { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { IntegrationHostFixedError } from '@integrations/domain/exceptions/integration-host-fixed.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { DefinitionDocument } from '@shared-kernel/domain/value-objects/definition-document.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Kept {
  readonly id: IntegrationDefinitionId;
  readonly teamId: TeamId;
  readonly source: SourceKey;
  readonly document: DefinitionDocument;
  readonly offers: readonly string[];
  readonly version: number;
}

interface State extends Kept {
  readonly retired: boolean;
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

const offeredBy = (compiled: Compiled): readonly string[] =>
  compiled.integration.offers.map((each) => each.tool);

export class IntegrationDefinition extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static define(
    input: Compiled & { id: IntegrationDefinitionId; teamId: TeamId },
  ): IntegrationDefinition {
    guardDescribes(input);

    const defined = new IntegrationDefinition({
      id: input.id,
      teamId: input.teamId,
      source: input.integration.source,
      document: input.document,
      offers: offeredBy(input),
      version: 0,
      retired: false,
    });

    defined.record(
      new IntegrationDefined(
        defined.id,
        defined.teamId,
        defined.source,
        defined.offers,
      ),
    );

    return defined;
  }

  static rehydrate(input: Kept): IntegrationDefinition {
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

    return new IntegrationDefinition({ ...input, retired: false });
  }

  expecting(version: number): void {
    if (version !== this.version) {
      throw new IntegrationDefinitionMovedOnError(this.source.value);
    }
  }

  redefinedAs(compiled: Compiled, given: ToolUses): IntegrationDefinition {
    this.guardLive();
    guardDescribes(compiled);

    if (!compiled.integration.source.equals(this.source)) {
      throw new IntegrationHostFixedError(
        this.source.value,
        `is for ${this.source.value} for its whole life; replace it to define ${compiled.integration.source.value}`,
      );
    }

    const offers = offeredBy(compiled);

    this.guardUnused(
      given,
      this.offers.filter((each) => !offers.includes(each)),
    );

    const redefined = this.with({ document: compiled.document, offers });

    redefined.record(
      new IntegrationRedefined(this.id, this.teamId, this.source, offers),
    );

    return redefined;
  }

  retired(given: ToolUses): IntegrationDefinition {
    this.guardLive();
    this.guardUnused(given, this.offers);

    const retired = this.with({ retired: true });

    retired.record(
      new IntegrationRetired(this.id, this.teamId, this.source, this.offers),
    );

    return retired;
  }

  get id(): IntegrationDefinitionId {
    return this.state.id;
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

  get offers(): readonly string[] {
    return this.state.offers;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  get isRetired(): boolean {
    return this.state.retired;
  }

  private with(change: Partial<State>): IntegrationDefinition {
    const next = new IntegrationDefinition({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }

  private guardLive(): void {
    if (this.isRetired) {
      throw new InconsistentStateError(
        'integration definition',
        'was changed after it was retired',
      );
    }
  }

  private guardUnused(given: ToolUses, withdrawn: readonly string[]): void {
    const stranded = given.ofAny(withdrawn);

    if (!stranded.isEmpty) {
      throw new IntegrationToolsInUseError(this.source.value, stranded);
    }
  }
}
