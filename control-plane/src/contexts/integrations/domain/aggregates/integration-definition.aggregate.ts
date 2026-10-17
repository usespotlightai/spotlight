import type { Integration } from '@integrations/domain/entities/integration.entity';
import { IntegrationCreated } from '@integrations/domain/events/integration-created.event';
import { IntegrationDeleted } from '@integrations/domain/events/integration-deleted.event';
import { IntegrationSpecRefreshed } from '@integrations/domain/events/integration-spec-refreshed.event';
import { IntegrationUpdated } from '@integrations/domain/events/integration-updated.event';
import { IntegrationDefinitionVersionConflictError } from '@integrations/domain/exceptions/integration-definition-version-conflict.error';
import { IntegrationToolsInUseError } from '@integrations/domain/exceptions/integration-tools-in-use.error';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { ApiSpec } from '@integrations/domain/value-objects/api-spec.vo';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { IntegrationDefinitionId } from '@integrations/domain/value-objects/integration-definition-id.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { SpecFetchResult } from '@integrations/domain/value-objects/spec-fetch-result.vo';
import { SpecRefreshDetail } from '@integrations/domain/value-objects/spec-refresh-detail.vo';
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
  readonly integration: IntegrationKey;
  readonly document: DefinitionDocument;
  readonly tools: readonly string[];
  readonly reading: SpecFetchResult | null;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
}

interface Compiled {
  readonly integration: Integration;
  readonly document: DefinitionDocument;
  readonly spec: ApiSpec | null;
}

const INTEGRATION_FIELD = 'integration';

const guardDescribes = (compiled: Compiled): void => {
  const integration = compiled.integration.key.value;

  if (!compiled.document.hasValue(INTEGRATION_FIELD, integration)) {
    throw new InvalidIntegrationError(
      integration,
      'was compiled for another integration',
    );
  }
};

const guardRead = (
  compiled: Compiled,
  reading: SpecFetchResult | null,
): void => {
  const integration = compiled.integration.key.value;
  const generatedFrom = compiled.integration.generatedFrom;

  if (!compiled.spec) {
    if (reading || generatedFrom) {
      throw new InvalidIntegrationError(
        integration,
        'received a fetched spec that it does not name',
      );
    }

    return;
  }

  if (!reading?.isOf(compiled.spec)) {
    throw new InvalidIntegrationError(
      integration,
      `names its ${compiled.spec.label} and did not receive a fetched spec`,
    );
  }

  if (generatedFrom && !reading.hash?.equals(generatedFrom)) {
    throw new InvalidIntegrationError(
      integration,
      `provides tools from another fetch of its ${compiled.spec.label} than the one it stores`,
    );
  }
};

const providedBy = (compiled: Compiled): readonly string[] =>
  compiled.integration.tools.map((each) => each.tool);

export class IntegrationDefinition extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    input: Compiled & {
      id: IntegrationDefinitionId;
      teamId: TeamId;
      reading: SpecFetchResult | null;
      by: Attribution;
    },
  ): IntegrationDefinition {
    guardDescribes(input);
    guardRead(input, input.reading);

    const created = new IntegrationDefinition({
      id: input.id,
      teamId: input.teamId,
      integration: input.integration.key,
      document: input.document,
      tools: providedBy(input),
      reading: input.reading,
      version: 0,
      deleted: false,
    });

    created.record(
      new IntegrationCreated(
        created.id,
        created.teamId,
        created.integration,
        created.tools,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): IntegrationDefinition {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'integration definition',
        'was stored without a version',
      );
    }

    if (!input.document.hasValue(INTEGRATION_FIELD, input.integration.value)) {
      throw new InconsistentStateError(
        'integration definition',
        'was stored under an integration name it does not define',
      );
    }

    return new IntegrationDefinition({ ...input, deleted: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new IntegrationDefinitionVersionConflictError(
        this.integration.value,
      );
    }
  }

  update(
    compiled: Compiled,
    reading: SpecFetchResult | null,
    enabled: ToolUses,
    by: Attribution,
  ): IntegrationDefinition {
    this.guardLive();
    guardDescribes(compiled);
    guardRead(compiled, reading);

    if (!compiled.integration.key.equals(this.integration)) {
      const because = `cannot change its integration name to ${compiled.integration.key.value}`;

      throw new ImmutableFieldError(
        'integration',
        because,
        `Integration ${this.integration.value} ${because}.`,
      );
    }

    const tools = providedBy(compiled);

    this.guardUnused(
      enabled,
      this.tools.filter((each) => !tools.includes(each)),
    );

    const updated = this.with({
      document: compiled.document,
      tools,
      reading,
    });

    updated.record(
      new IntegrationUpdated(
        this.id,
        this.teamId,
        this.integration,
        tools,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  changesSpec(reading: SpecFetchResult): boolean {
    const current = this.state.reading;

    return (
      !current ||
      current.fingerprint !== reading.fingerprint ||
      (current.hash?.value ?? null) !== (reading.hash?.value ?? null) ||
      current.problem !== reading.problem
    );
  }

  refreshSpec(
    compiled: Compiled,
    reading: SpecFetchResult,
    by: Attribution,
  ): IntegrationDefinition {
    this.guardLive();
    guardDescribes(compiled);
    guardRead(compiled, reading);

    if (!compiled.document.equals(this.document)) {
      throw new InvalidIntegrationError(
        this.integration.value,
        'refreshed its spec from a definition other than the one it stores',
      );
    }

    const tools = providedBy(compiled);
    const orphanedTools = this.tools.filter((each) => !tools.includes(each));
    const refreshed = this.with({ tools, reading });

    refreshed.record(
      new IntegrationSpecRefreshed(
        this.id,
        this.teamId,
        this.integration,
        tools,
        orphanedTools,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          SpecRefreshDetail.of({
            hash: reading.hash?.value ?? null,
            problem: reading.problem,
            orphanedTools,
          }),
        ),
      ),
    );

    return refreshed;
  }

  delete(enabled: ToolUses, by: Attribution): IntegrationDefinition {
    this.guardLive();
    this.guardUnused(enabled, this.tools);

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
      this.integration,
      this.tools,
      ConfigurationChange.deleted(this.whatChanged, by),
    );
  }

  private get whatChanged() {
    return {
      resource: 'integration' as const,
      id: this.id.value,
      key: this.integration.value,
    };
  }

  get id(): IntegrationDefinitionId {
    return this.state.id;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get integration(): IntegrationKey {
    return this.state.integration;
  }

  get document(): DefinitionDocument {
    return this.state.document;
  }

  get tools(): readonly string[] {
    return this.state.tools;
  }

  get reading(): SpecFetchResult | null {
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

  private guardUnused(enabled: ToolUses, removed: readonly string[]): void {
    const orphaned = enabled.ofAny(removed);

    if (!orphaned.isEmpty) {
      throw new IntegrationToolsInUseError(this.integration.value, orphaned);
    }
  }
}
