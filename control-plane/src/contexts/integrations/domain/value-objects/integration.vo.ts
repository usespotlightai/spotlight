import { ConnectionNotTakenError } from '@integrations/domain/exceptions/connection-not-taken.error';
import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import type { ApiSpecKind } from '@integrations/domain/value-objects/api-spec.vo';
import type { Binding } from '@integrations/domain/value-objects/binding.vo';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { IntegrationLogo } from '@integrations/domain/value-objects/integration-logo.vo';
import type { Poll } from '@integrations/domain/value-objects/poll.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { Webhook } from '@integrations/domain/value-objects/webhook.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export type ConnectionKind = 'oauth2' | 'secrets';

export interface IntegrationParts {
  readonly webhook: boolean;
  readonly poll: boolean;
  readonly schedule: boolean;
  readonly actions: number;
  readonly bindings: number;
  readonly apiSpecs: readonly ApiSpecKind[];
}

export class Integration {
  static readonly DOES_NOTHING =
    'must do something: a webhook, a poll, a schedule, an action to run, or an API spec or MCP server to provide tools from';

  static readonly TWO_API_SPECS =
    'offers tools from one API spec: an openapi, a graphql or an mcp, not two';

  static doesSomething(parts: IntegrationParts): boolean {
    return (
      parts.webhook ||
      parts.poll ||
      parts.schedule ||
      parts.actions > 0 ||
      parts.bindings > 0 ||
      parts.apiSpecs.length > 0
    );
  }

  static readsOneApiSpec(apiSpecs: readonly ApiSpecKind[]): boolean {
    return apiSpecs.length < 2;
  }

  private constructor(
    readonly key: IntegrationKey,
    readonly name: string,
    readonly logo: IntegrationLogo | null,
    readonly webhook: Webhook | null,
    readonly poll: Poll | null,
    readonly schedule: Schedule | null,
    readonly actions: DefinedActions,
    readonly bindings: readonly Binding[],
    readonly credentials: readonly SecretName[],
    readonly requiresConnection: boolean,
    readonly actsAs: ActsAs,
    readonly writtenTools: readonly ProvidedTool[],
    readonly apiSpec: ApiSpecKind | null,
  ) {}

  static of(input: {
    key: IntegrationKey;
    name?: string;
    logo?: IntegrationLogo | null;
    webhook?: Webhook | null;
    poll?: Poll | null;
    schedule?: Schedule | null;
    actions?: DefinedActions;
    bindings?: readonly Binding[];
    credentials?: readonly SecretName[];
    connectsOver?: ConnectionKind | null;
    actsAs?: ActsAs;
    apiSpecs?: readonly ApiSpecKind[];
    writtenTools?: readonly ProvidedTool[];
  }): Integration {
    const key = input.key;
    const webhook = input.webhook ?? null;
    const poll = input.poll ?? null;
    const declares = [...(webhook?.declares ?? []), ...(poll?.declares ?? [])];

    for (const declared of declares) {
      key.claim(declared.happening);
    }

    const happenings = declares.map((each) => each.happening.value);

    if (new Set(happenings).size !== happenings.length) {
      throw new InvalidIntegrationError(
        key.value,
        'defines a happening more than once',
      );
    }

    const tools = input.writtenTools ?? [];

    for (const provided of tools) {
      if (provided.backing.spec) {
        throw new InvalidIntegrationError(
          key.value,
          `writes tool ${provided.tool.value} from an API spec operation`,
        );
      }

      if (!provided.integration.equals(key)) {
        throw new InvalidIntegrationError(
          key.value,
          `offers tool ${provided.tool.value}, which is named for another integration`,
        );
      }
    }

    const names = tools.map((each) => each.tool.value);

    if (new Set(names).size !== names.length) {
      throw new InvalidIntegrationError(
        key.value,
        'offers a tool more than once',
      );
    }

    const bindings = input.bindings ?? [];

    const actions = input.actions ?? DefinedActions.of([]);
    const schedule = input.schedule ?? null;
    const apiSpecs = input.apiSpecs ?? [];

    if (!Integration.readsOneApiSpec(apiSpecs)) {
      throw new InvalidIntegrationError(key.value, Integration.TWO_API_SPECS);
    }

    if (schedule) {
      actions.calledBy(schedule.action.name, 'schedule', 'schedule');
    }

    for (const binding of bindings) {
      actions.calledBy(
        binding.action,
        binding.about,
        `binding on ${binding.event}`,
      );
    }

    for (const provided of tools) {
      if (provided.backing.action !== null) {
        actions.calledBy(
          provided.backing.action,
          'tool',
          `tool ${provided.tool.value}`,
        );
      }
    }

    const requiresConnection = input.connectsOver === 'oauth2';
    const actsAs = input.actsAs ?? ActsAs.team();

    if (actsAs.byRequester && !requiresConnection) {
      throw new InvalidIntegrationError(
        key.value,
        'takes each person’s connection. A person can connect only over oauth2',
      );
    }

    if (
      !Integration.doesSomething({
        webhook: webhook !== null,
        poll: poll !== null,
        schedule: schedule !== null,
        actions: actions.all.length,
        bindings: bindings.length,
        apiSpecs,
      })
    ) {
      throw new InvalidIntegrationError(key.value, Integration.DOES_NOTHING);
    }

    return new Integration(
      key,
      (input.name ?? key.value).trim() || key.value,
      input.logo ?? null,
      webhook,
      poll,
      schedule,
      actions,
      bindings,
      input.credentials ?? [],
      requiresConnection,
      actsAs,
      tools,
      apiSpecs[0] ?? null,
    );
  }

  get declares(): readonly DeclaredHappening[] {
    return [...(this.webhook?.declares ?? []), ...(this.poll?.declares ?? [])];
  }

  raises(happening: { readonly value: string }): boolean {
    return this.declares.some(
      (each) => each.happening.value === happening.value,
    );
  }

  postsOn(event: string): boolean {
    return this.bindings.some((each) => each.isFor(event));
  }

  usesSecret(secret: SecretName): boolean {
    return this.credentials.some((each) => each.equals(secret));
  }

  takesConnectionFrom(owner: ConnectionOwner): boolean {
    return (
      this.requiresConnection && (!owner.isPerson || this.actsAs.byRequester)
    );
  }

  assertTakesConnectionFrom(owner: ConnectionOwner): void {
    if (!this.takesConnectionFrom(owner)) {
      throw new ConnectionNotTakenError(this.key.value, owner.kind);
    }
  }

  writtenTool(tool: ToolName): ProvidedTool | null {
    return this.writtenTools.find((each) => each.tool.equals(tool)) ?? null;
  }
}
