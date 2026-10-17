import type {
  Hook,
  HookOnFailure,
} from '@integrations/domain/entities/hook.entity';
import { HookDefined } from '@integrations/domain/events/hook-defined.event';
import { HookRedefined } from '@integrations/domain/events/hook-redefined.event';
import { HookRetired } from '@integrations/domain/events/hook-retired.event';
import { HookDefinitionVersionConflictError } from '@integrations/domain/exceptions/hook-definition-version-conflict.error';
import { HookKeyFixedError } from '@integrations/domain/exceptions/hook-key-fixed.error';
import { InvalidHookError } from '@integrations/domain/exceptions/invalid-hook.error';
import type { DefinitionDocument } from '@integrations/domain/value-objects/definition-document.vo';
import type { HookDefinitionId } from '@integrations/domain/value-objects/hook-definition-id.vo';
import type { HookEvent } from '@integrations/domain/value-objects/hook-event.vo';
import type { HookKey } from '@integrations/domain/value-objects/hook-key.vo';
import type { HookSigningSecret } from '@integrations/domain/value-objects/hook-signing-secret.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
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
  readonly retired: boolean;
  readonly givenSecret: HookSigningSecret | null;
}

interface Signing {
  readonly signing: SigningVersion | null;
  readonly givenSecret: HookSigningSecret | null;
}

export interface Compiled {
  readonly hook: Hook;
  readonly document: DefinitionDocument;
}

export type SecretGiven =
  | { readonly kind: 'given'; readonly versioned: VersionedSigningSecret }
  | { readonly kind: 'kept'; readonly version: number }
  | { readonly kind: 'none' };

export interface HookAllowances {
  readonly offered: readonly string[];
  readonly signsTokens: boolean;
  allowsHost(host: string): boolean;
}

const guardAllowed = (hook: Hook, allowances: HookAllowances): void => {
  const missing = hook.matchedTools.filter(
    (tool) => !allowances.offered.includes(tool.value),
  );

  if (missing.length > 0) {
    throw new InvalidHookError(
      FieldPath.of(['match', 'tools']),
      `names tools no team integration offers: ${missing.map((tool) => tool.value).join(', ')}`,
    );
  }

  hook.steps.forEach((step, index) => {
    if (step.kind === 'call' && !allowances.offered.includes(step.tool.value)) {
      throw new InvalidHookError(
        FieldPath.of(['steps', index, 'call']),
        `names tool ${step.tool.value}, which no team integration offers`,
      );
    }

    if (
      step.kind === 'request' &&
      !step.fromNetwork &&
      step.url &&
      !allowances.allowsHost(step.url.host)
    ) {
      throw new InvalidHookError(
        FieldPath.of(['steps', index, 'request', 'url']),
        `sends to ${step.url.host}, which is not an allowed outbound host`,
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

const NOT_SIGNED: Signing = { signing: null, givenSecret: null };

const signingFor = (
  hook: Hook,
  given: SecretGiven,
  stored: SigningVersion | null,
): Signing => {
  if (hook.signing !== 'hmac') {
    return NOT_SIGNED;
  }

  if (given.kind === 'given') {
    return stored && given.versioned.version === stored.version
      ? { signing: stored, givenSecret: null }
      : {
          signing: { version: given.versioned.version },
          givenSecret: given.versioned.secret,
        };
  }

  if (stored && (given.kind === 'none' || given.version === stored.version)) {
    return { signing: stored, givenSecret: null };
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

  static define(
    input: Compiled & {
      id: HookDefinitionId;
      workspaceId: WorkspaceId;
      teamId: TeamId;
      secret: SecretGiven;
      allowances: HookAllowances;
      by: Attribution;
    },
  ): HookDefinition {
    guardAllowed(input.hook, input.allowances);

    const defined = new HookDefinition({
      id: input.id,
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      key: input.hook.key,
      event: input.hook.event,
      document: input.document,
      tools: input.hook.tools,
      ...signingFor(input.hook, input.secret, null),
      version: 0,
      retired: false,
    });

    defined.record(
      new HookDefined(
        defined.id,
        defined.teamId,
        defined.key,
        ConfigurationChange.created(defined.whatChanged, input.by),
      ),
    );

    return defined;
  }

  static rehydrate(input: Props): HookDefinition {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'hook definition',
        'was kept without a version',
      );
    }

    return new HookDefinition({ ...input, retired: false, givenSecret: null });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new HookDefinitionVersionConflictError(this.key.value);
    }
  }

  redefinedAs(
    compiled: Compiled,
    secret: SecretGiven,
    allowances: HookAllowances,
    by: Attribution,
  ): HookDefinition {
    this.guardLive();

    if (!compiled.hook.key.equals(this.key)) {
      throw new HookKeyFixedError(
        this.key.value,
        `cannot change its key to ${compiled.hook.key.value}`,
      );
    }

    guardAllowed(compiled.hook, allowances);

    const redefined = this.with({
      event: compiled.hook.event,
      document: compiled.document,
      tools: compiled.hook.tools,
      ...signingFor(compiled.hook, secret, this.signing),
    });

    redefined.record(
      new HookRedefined(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  retire(by: Attribution): HookDefinition {
    this.guardLive();

    const retired = this.with({ retired: true });

    retired.record(this.retiredBy(by));

    return retired;
  }

  abandon(by: Attribution): HookDefinition {
    return this.retire(by);
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

    return this.state.document.says('failure', blocking);
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get signing(): SigningVersion | null {
    return this.state.signing;
  }

  get givenSecret(): HookSigningSecret | null {
    return this.state.givenSecret;
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

  private retiredBy(by: Attribution): HookRetired {
    return new HookRetired(
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
    if (this.isRetired) {
      throw new InconsistentStateError(
        'hook definition',
        'was changed after it was retired',
      );
    }
  }
}
