import type { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationCreated } from '@integrations/domain/events/integration-created.event';
import { IntegrationDeleted } from '@integrations/domain/events/integration-deleted.event';
import { IntegrationReread } from '@integrations/domain/events/integration-reread.event';
import { IntegrationUpdated } from '@integrations/domain/events/integration-updated.event';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { DescribedSource } from '@integrations/domain/value-objects/described-source.vo';
import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import { RereadDetail } from '@integrations/domain/value-objects/reread-detail.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { SourceReading } from '@integrations/domain/value-objects/source-reading.vo';
import type { ToolUses } from '@integrations/domain/value-objects/tool-uses.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Props {
  readonly id: IntegrationDefinitionId;
  readonly teamId: TeamId;
  readonly source: SourceKey;
  readonly document: DefinitionDocument;
  readonly offers: readonly string[];
  readonly reading: SourceReading | null;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
}

interface Compiled {
  readonly integration: Integration;
  readonly document: DefinitionDocument;
  readonly source: DescribedSource | null;
}

const SOURCE_FIELD = 'integration';

const guardDescribes = (compiled: Compiled): void => {
  const source = compiled.integration.source.value;

  if (!compiled.document.hasValue(SOURCE_FIELD, source)) {
    throw new InvalidIntegrationError(source, 'was compiled for another host');
  }
};

const guardRead = (compiled: Compiled, reading: SourceReading | null): void => {
  const source = compiled.integration.source.value;
  const generatedFrom = compiled.integration.generatedFrom;

  if (!compiled.source) {
    if (reading || generatedFrom) {
      throw new InvalidIntegrationError(
        source,
        'was given a reading of a description it does not name',
      );
    }

    return;
  }

  if (!reading?.isOf(compiled.source)) {
    throw new InvalidIntegrationError(
      source,
      `names its ${compiled.source.described} and was not given a reading of it`,
    );
  }

  if (generatedFrom && !reading.hash?.equals(generatedFrom)) {
    throw new InvalidIntegrationError(
      source,
      `offers tools from another reading of its ${compiled.source.described} than the one it keeps`,
    );
  }
};

const offeredBy = (compiled: Compiled): readonly string[] =>
  compiled.integration.offers.map((each) => each.tool);

export class IntegrationDefinition extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    input: Compiled & {
      id: IntegrationDefinitionId;
      teamId: TeamId;
      reading: SourceReading | null;
      by: Attribution;
    },
  ): IntegrationDefinition {
    guardDescribes(input);
    guardRead(input, input.reading);

    const created = new IntegrationDefinition({
      id: input.id,
      teamId: input.teamId,
      source: input.integration.source,
      document: input.document,
      offers: offeredBy(input),
      reading: input.reading,
      version: 0,
      deleted: false,
    });

    created.record(
      new IntegrationCreated(
        created.id,
        created.teamId,
        created.source,
        created.offers,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): IntegrationDefinition {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'integration definition',
        'was kept without a version',
      );
    }

    if (!input.document.hasValue(SOURCE_FIELD, input.source.value)) {
      throw new InconsistentStateError(
        'integration definition',
        'was kept under a host it does not define',
      );
    }

    return new IntegrationDefinition({ ...input, deleted: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new IntegrationDefinitionVersionConflictError(this.source.value);
    }
  }

  update(
    compiled: Compiled,
    reading: SourceReading | null,
    given: ToolUses,
    by: Attribution,
  ): IntegrationDefinition {
    this.guardLive();
    guardDescribes(compiled);
    guardRead(compiled, reading);

    if (!compiled.integration.source.equals(this.source)) {
      const because = `cannot change its host to ${compiled.integration.source.value}`;

      throw new ImmutableFieldError(
        'integration',
        because,
        `Integration ${this.source.value} ${because}.`,
      );
    }

    const offers = offeredBy(compiled);

    this.guardUnused(
      given,
      this.offers.filter((each) => !offers.includes(each)),
    );

    const updated = this.with({
      document: compiled.document,
      offers,
      reading,
    });

    updated.record(
      new IntegrationUpdated(
        this.id,
        this.teamId,
        this.source,
        offers,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  rereads(reading: SourceReading): boolean {
    const current = this.state.reading;

    return (
      !current ||
      current.fingerprint !== reading.fingerprint ||
      (current.hash?.value ?? null) !== (reading.hash?.value ?? null) ||
      current.problem !== reading.problem
    );
  }

  reread(
    compiled: Compiled,
    reading: SourceReading,
    by: Attribution,
  ): IntegrationDefinition {
    this.guardLive();
    guardDescribes(compiled);
    guardRead(compiled, reading);

    if (!compiled.document.equals(this.document)) {
      throw new InvalidIntegrationError(
        this.source.value,
        'was reread from a definition other than the one it keeps',
      );
    }

    const offers = offeredBy(compiled);
    const stranded = this.offers.filter((each) => !offers.includes(each));
    const reread = this.with({ offers, reading });

    reread.record(
      new IntegrationReread(
        this.id,
        this.teamId,
        this.source,
        offers,
        stranded,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          RereadDetail.of({
            hash: reading.hash?.value ?? null,
            problem: reading.problem,
            stranded,
          }),
        ),
      ),
    );

    return reread;
  }

  delete(given: ToolUses, by: Attribution): IntegrationDefinition {
    this.guardLive();
    this.guardUnused(given, this.offers);

    const deleted = this.with({ deleted: true });

    deleted.record(this.deletedBy(by));

    return deleted;
  }

  cascadeDelete(by: Attribution): IntegrationDefinition {
    this.guardLive();

    const deleted = this.with({ deleted: true });

    deleted.record(this.deletedBy(by));

    return deleted;
  }

  private deletedBy(by: Attribution): IntegrationDeleted {
    return new IntegrationDeleted(
      this.id,
      this.teamId,
      this.source,
      this.offers,
      ConfigurationChange.deleted(this.whatChanged, by),
    );
  }

  private get whatChanged() {
    return {
      resource: 'integration' as const,
      id: this.id.value,
      key: this.source.value,
    };
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

  get reading(): SourceReading | null {
    return this.state.reading;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  get isDeleted(): boolean {
    return this.state.deleted;
  }

  private with(change: Partial<State>): IntegrationDefinition {
    const next = new IntegrationDefinition({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }

  private guardLive(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'integration definition',
        'was changed after it was deleted',
      );
    }
  }

  private guardUnused(given: ToolUses, removed: readonly string[]): void {
    const stranded = given.ofAny(removed);

    if (!stranded.isEmpty) {
      throw new IntegrationToolsInUseError(this.source.value, stranded);
    }
  }
}
