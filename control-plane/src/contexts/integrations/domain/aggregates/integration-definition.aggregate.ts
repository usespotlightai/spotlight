import type { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationDefined } from '@integrations/domain/events/integration-defined.event';
import { IntegrationRedefined } from '@integrations/domain/events/integration-redefined.event';
import { IntegrationReread } from '@integrations/domain/events/integration-reread.event';
import { IntegrationRetired } from '@integrations/domain/events/integration-retired.event';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import { IntegrationHostFixedError } from '@integrations/domain/exceptions/integration-host-fixed.error';
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
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Kept {
  readonly id: IntegrationDefinitionId;
  readonly teamId: TeamId;
  readonly source: SourceKey;
  readonly document: DefinitionDocument;
  readonly offers: readonly string[];
  readonly reading: SourceReading | null;
  readonly version: number;
}

interface State extends Kept {
  readonly retired: boolean;
}

interface Compiled {
  readonly integration: Integration;
  readonly document: DefinitionDocument;
  readonly source: DescribedSource | null;
}

const SOURCE_FIELD = 'integration';

const guardDescribes = (compiled: Compiled): void => {
  const source = compiled.integration.source.value;

  if (!compiled.document.says(SOURCE_FIELD, source)) {
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

  static define(
    input: Compiled & {
      id: IntegrationDefinitionId;
      teamId: TeamId;
      reading: SourceReading | null;
      by: Attribution;
    },
  ): IntegrationDefinition {
    guardDescribes(input);
    guardRead(input, input.reading);

    const defined = new IntegrationDefinition({
      id: input.id,
      teamId: input.teamId,
      source: input.integration.source,
      document: input.document,
      offers: offeredBy(input),
      reading: input.reading,
      version: 0,
      retired: false,
    });

    defined.record(
      new IntegrationDefined(
        defined.id,
        defined.teamId,
        defined.source,
        defined.offers,
        ConfigurationChange.created(defined.whatChanged, input.by),
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

  redefinedAs(
    compiled: Compiled,
    reading: SourceReading | null,
    given: ToolUses,
    by: Attribution,
  ): IntegrationDefinition {
    this.guardLive();
    guardDescribes(compiled);
    guardRead(compiled, reading);

    if (!compiled.integration.source.equals(this.source)) {
      throw new IntegrationHostFixedError(
        this.source.value,
        `cannot change its host to ${compiled.integration.source.value}`,
      );
    }

    const offers = offeredBy(compiled);

    this.guardUnused(
      given,
      this.offers.filter((each) => !offers.includes(each)),
    );

    const redefined = this.with({
      document: compiled.document,
      offers,
      reading,
    });

    redefined.record(
      new IntegrationRedefined(
        this.id,
        this.teamId,
        this.source,
        offers,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  rereads(reading: SourceReading): boolean {
    const standing = this.state.reading;

    return (
      !standing ||
      standing.fingerprint !== reading.fingerprint ||
      (standing.hash?.value ?? null) !== (reading.hash?.value ?? null) ||
      standing.problem !== reading.problem
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

  retired(given: ToolUses, by: Attribution): IntegrationDefinition {
    this.guardLive();
    this.guardUnused(given, this.offers);

    const retired = this.with({ retired: true });

    retired.record(this.retiredBy(by));

    return retired;
  }

  abandoned(by: Attribution): IntegrationDefinition {
    this.guardLive();

    const abandoned = this.with({ retired: true });

    abandoned.record(this.retiredBy(by));

    return abandoned;
  }

  private retiredBy(by: Attribution): IntegrationRetired {
    return new IntegrationRetired(
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
