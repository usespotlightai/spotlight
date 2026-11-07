import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import { ActsAs } from '@integrations/domain/value-objects/acts-as.vo';
import type { Binding } from '@integrations/domain/value-objects/binding.vo';
import type { ConnectionOwner } from '@integrations/domain/value-objects/connection-owner.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import type { Poll } from '@integrations/domain/value-objects/poll.vo';
import type { ProvidedTool } from '@integrations/domain/value-objects/provided-tool.vo';
import type { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import type { ToolName } from '@integrations/domain/value-objects/tool-name.vo';
import type { Webhook } from '@integrations/domain/value-objects/webhook.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class Integration {
  private constructor(
    readonly key: IntegrationKey,
    readonly name: string,
    readonly webhook: Webhook | null,
    readonly poll: Poll | null,
    readonly schedule: Schedule | null,
    readonly actions: DefinedActions,
    readonly bindings: readonly Binding[],
    readonly credentials: readonly SecretName[],
    readonly requiresConnection: boolean,
    readonly actsAs: ActsAs,
    readonly tools: readonly ProvidedTool[],
  ) {}

  static of(input: {
    key: IntegrationKey;
    name?: string;
    webhook?: Webhook | null;
    poll?: Poll | null;
    schedule?: Schedule | null;
    actions?: DefinedActions;
    bindings?: readonly Binding[];
    credentials?: readonly SecretName[];
    requiresConnection?: boolean;
    actsAs?: ActsAs;
    tools?: readonly ProvidedTool[];
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

    const tools = input.tools ?? [];

    for (const provided of tools) {
      if (!provided.integration.equals(key)) {
        throw new InvalidIntegrationError(
          key.value,
          `offers tool ${provided.tool}, which is named for another integration`,
        );
      }
    }

    const names = tools.map((each) => each.tool);

    if (new Set(names).size !== names.length) {
      throw new InvalidIntegrationError(
        key.value,
        'offers a tool more than once',
      );
    }

    const read = new Set(
      tools.flatMap((each) =>
        each.backing.spec ? [each.backing.spec.hash.value] : [],
      ),
    );

    if (read.size > 1) {
      throw new InvalidIntegrationError(
        key.value,
        'provides tools from two fetches of its spec',
      );
    }

    const bindings = input.bindings ?? [];

    const actions = input.actions ?? DefinedActions.of([]);
    const schedule = input.schedule ?? null;

    if (schedule) {
      actions.forSchedule(schedule.action, 'schedule');
    }

    for (const binding of bindings) {
      actions.forBinding(
        binding.action,
        binding.event,
        `binding on ${binding.event}`,
      );
    }

    for (const provided of tools) {
      if (provided.backing.action !== null) {
        actions.forTool(provided.backing.action, `tool ${provided.tool}`);
      }
    }

    const requiresConnection = input.requiresConnection ?? false;
    const actsAs = input.actsAs ?? ActsAs.team();

    if (actsAs.byRequester && !requiresConnection) {
      throw new InvalidIntegrationError(
        key.value,
        'takes each person’s connection. A person can connect only over oauth2',
      );
    }

    return new Integration(
      key,
      (input.name ?? key.value).trim() || key.value,
      webhook,
      poll,
      schedule,
      actions,
      bindings,
      input.credentials ?? [],
      requiresConnection,
      actsAs,
      tools,
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

  get generatedFrom(): ContentHash | null {
    return (
      this.tools.find((each) => each.backing.spec)?.backing.spec?.hash ?? null
    );
  }

  takesConnectionFrom(owner: ConnectionOwner): boolean {
    return (
      this.requiresConnection && (!owner.isPerson || this.actsAs.byRequester)
    );
  }

  generatedToolCount(provided: readonly string[]): number {
    return provided.filter((each) => this.providedTool(each) === null).length;
  }

  takesPersonRuleFor(tool: ToolName): boolean {
    return this.actsAs.byRequester && this.providedTool(tool.value) !== null;
  }

  providedTool(tool: string): ProvidedTool | null {
    return this.tools.find((each) => each.tool === tool) ?? null;
  }

  equals(other: Integration): boolean {
    return this.key.equals(other.key);
  }
}
