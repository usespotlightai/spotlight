import type {
  Hook,
  HookOnFailure,
} from '@integrations/domain/entities/hook.entity';
import { HookCreated } from '@integrations/domain/events/hook-created.event';
import { HookDeleted } from '@integrations/domain/events/hook-deleted.event';
import { HookUpdated } from '@integrations/domain/events/hook-updated.event';
import { HookDefinitionVersionConflictError } from '@integrations/domain/exceptions/hook-definition-version-conflict.error';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

interface VersionedSigningSecret {
  readonly secret: HookSigningSecret;
  readonly version: number;
}

export interface SigningVersion {
  readonly version: number;
}

interface Props {
  readonly id: HookDefinitionId;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly key: HookKey;
  readonly event: HookEvent;
  readonly document: DefinitionDocument;
  readonly tools: readonly ToolName[];
  readonly signing: SigningVersion | null;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
  readonly secretInput: HookSigningSecret | null;
}

interface Signing {
  readonly signing: SigningVersion | null;
  readonly secretInput: HookSigningSecret | null;
}

export interface Compiled {
  readonly hook: Hook;
  readonly document: DefinitionDocument;
}

export type SigningSecretChange =
  | { readonly kind: 'supplied'; readonly versioned: VersionedSigningSecret }
  | { readonly kind: 'unchanged'; readonly version: number }
  | { readonly kind: 'none' };

export interface HookAllowances {
  readonly provided: readonly string[];
  readonly signsTokens: boolean;
  allowsHost(host: string): boolean;
}

const guardAllowed = (hook: Hook, allowances: HookAllowances): void => {
  const missing = hook.matchedTools.filter(
    (tool) => !allowances.provided.includes(tool.value),
  );

  if (missing.length > 0) {
    throw new InvalidHookError(
      FieldPath.of(['match', 'tools']),
      `names tools no team integration offers: ${missing.map((tool) => tool.value).join(', ')}`,
    );
  }

  hook.steps.forEach((step, index) => {
    if (
      step.kind === 'call' &&
      !allowances.provided.includes(step.tool.value)
    ) {
      throw new InvalidHookError(
        FieldPath.of(['steps', index, 'call']),
        `names tool ${step.tool.value}, which no team integration offers`,
      );
    }

    if (
      step.kind === 'request' &&
      !step.fromNetwork &&
      step.url &&
      !allowances.allowsHost(step.url.hostname)
    ) {
      throw new InvalidHookError(
        FieldPath.of(['steps', index, 'request', 'url']),
        `sends to ${step.url.hostname}, which is not an allowed outbound host`,
      );
    }
  });

  if (hook.signing === 'oidc' && !allowances.signsTokens) {
    throw new InvalidHookError(
      FieldPath.of(['signing', 'oidc']),
      'needs HOOK_SIGNING_KEY set to sign OIDC tokens',
    );
  }
};

const NOT_SIGNED: Signing = { signing: null, secretInput: null };

const signingFor = (
  hook: Hook,
  change: SigningSecretChange,
  stored: SigningVersion | null,
): Signing => {
  if (hook.signing !== 'hmac') {
    return NOT_SIGNED;
  }

  if (change.kind === 'supplied') {
    return stored && change.versioned.version === stored.version
      ? { signing: stored, secretInput: null }
      : {
          signing: { version: change.versioned.version },
          secretInput: change.versioned.secret,
        };
  }

  if (stored && (change.kind === 'none' || change.version === stored.version)) {
    return { signing: stored, secretInput: null };
  }

  if (stored) {
    throw new InvalidHookError(
      FieldPath.of(['signing', 'secret']),
      `is required when secretVersion changes from ${stored.version}`,
    );
  }

  throw new InvalidHookError(
    FieldPath.of(['signing', 'secret']),
    'is required for HMAC signing',
  );
};

export class HookDefinition extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    input: Compiled & {
      id: HookDefinitionId;
      workspaceId: WorkspaceId;
      teamId: TeamId;
      secret: SigningSecretChange;
      allowances: HookAllowances;
      by: ChangeActor;
    },
  ): HookDefinition {
    guardAllowed(input.hook, input.allowances);

    const created = new HookDefinition({
      id: input.id,
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      key: input.hook.key,
      event: input.hook.event,
      document: input.document,
      tools: input.hook.tools,
      ...signingFor(input.hook, input.secret, null),
      version: 0,
      deleted: false,
    });

    created.record(
      new HookCreated(
        created.id,
        created.teamId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): HookDefinition {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'hook definition',
        'was stored without a version',
      );
    }

    return new HookDefinition({ ...input, deleted: false, secretInput: null });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new HookDefinitionVersionConflictError(this.key.value);
    }
  }

  update(
    compiled: Compiled,
    secret: SigningSecretChange,
    allowances: HookAllowances,
    by: ChangeActor,
  ): HookDefinition {
    this.guardLive();

    if (!compiled.hook.key.equals(this.key)) {
      const because = `cannot change its key to ${compiled.hook.key.value}`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Hook ${this.key.value} ${because}.`,
      );
    }

    guardAllowed(compiled.hook, allowances);

    const updated = this.with({
      event: compiled.hook.event,
      document: compiled.document,
      tools: compiled.hook.tools,
      ...signingFor(compiled.hook, secret, this.signing),
    });

    updated.record(
      new HookUpdated(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(by: ChangeActor): HookDefinition {
    this.guardLive();

    const deleted = this.with({ deleted: true });

    deleted.record(this.deletedBy(by));

    return deleted;
  }

  cascadeDelete(by: ChangeActor): HookDefinition {
    return this.delete(by);
  }

  get id(): HookDefinitionId {
    return this.state.id;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get key(): HookKey {
    return this.state.key;
  }

  get event(): HookEvent {
    return this.state.event;
  }

  get document(): DefinitionDocument {
    return this.state.document;
  }

  get tools(): readonly ToolName[] {
    return this.state.tools;
  }

  get blocks(): boolean {
    const blocking: HookOnFailure = 'block';

    return this.state.document.hasValue('failure', blocking);
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get signing(): SigningVersion | null {
    return this.state.signing;
  }

  get secretInput(): HookSigningSecret | null {
    return this.state.secretInput;
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

  private deletedBy(by: ChangeActor): HookDeleted {
    return new HookDeleted(
      this.id,
      this.teamId,
      this.key,
      ConfigurationChange.deleted(this.whatChanged, by),
    );
  }

  private get whatChanged() {
    return {
      resource: 'hook' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private with(change: Partial<State>): HookDefinition {
    const next = new HookDefinition({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }

  private guardLive(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'hook definition',
        'was changed after it was deleted',
      );
    }
  }
}
