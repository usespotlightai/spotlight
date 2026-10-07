import { InvalidIntegrationError } from '@integrations/domain/exceptions/invalid-integration.error';
import type { Binding } from '@integrations/domain/value-objects/binding.vo';
import type { ConnectionHolder } from '@integrations/domain/value-objects/connection-holder.vo';
import { ConnectionHolding } from '@integrations/domain/value-objects/connection-holding.vo';
import type { ContentHash } from '@integrations/domain/value-objects/content-hash.vo';
import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { DefinedActions } from '@integrations/domain/value-objects/defined-actions.vo';
import type { OfferedTool } from '@integrations/domain/value-objects/offered-tool.vo';
import type { Poll } from '@integrations/domain/value-objects/poll.vo';
import type { Schedule } from '@integrations/domain/value-objects/schedule.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import type { Webhook } from '@integrations/domain/value-objects/webhook.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

export class Integration {
  private constructor(
    readonly source: SourceKey,
    readonly name: string,
    readonly webhook: Webhook | null,
    readonly poll: Poll | null,
    readonly schedule: Schedule | null,
    readonly actions: DefinedActions,
    readonly bindings: readonly Binding[],
    readonly credentials: readonly SecretName[],
    readonly connects: boolean,
    readonly holding: ConnectionHolding,
    readonly offers: readonly OfferedTool[],
  ) {}

  static of(input: {
    source: SourceKey;
    name?: string;
    webhook?: Webhook | null;
    poll?: Poll | null;
    schedule?: Schedule | null;
    actions?: DefinedActions;
    bindings?: readonly Binding[];
    credentials?: readonly SecretName[];
    connects?: boolean;
    holding?: ConnectionHolding;
    offers?: readonly OfferedTool[];
  }): Integration {
    const source = input.source;
    const webhook = input.webhook ?? null;
    const poll = input.poll ?? null;
    const declares = [...(webhook?.declares ?? []), ...(poll?.declares ?? [])];

    for (const declared of declares) {
      source.claim(declared.happening);
    }

    const words = declares.map((each) => each.happening.value);

    if (new Set(words).size !== words.length) {
      throw new InvalidIntegrationError(
        source.value,
        'defines a word more than once',
      );
    }

    const offers = input.offers ?? [];

    for (const offered of offers) {
      if (!offered.source.equals(source)) {
        throw new InvalidIntegrationError(
          source.value,
          `offers tool ${offered.tool}, which is named for another integration`,
        );
      }
    }

    const tools = offers.map((each) => each.tool);

    if (new Set(tools).size !== tools.length) {
      throw new InvalidIntegrationError(
        source.value,
        'offers a tool more than once',
      );
    }

    const read = new Set(
      offers.flatMap((each) =>
        each.backing.described ? [each.backing.described.hash.value] : [],
      ),
    );

    if (read.size > 1) {
      throw new InvalidIntegrationError(
        source.value,
        'offers tools from two readings of its description',
      );
    }

    const bindings = input.bindings ?? [];
    const events = bindings.map((each) => each.event);

    if (new Set(events).size !== events.length) {
      throw new InvalidIntegrationError(
        source.value,
        'binds an event more than once',
      );
    }

    const actions = input.actions ?? DefinedActions.of([]);
    const schedule = input.schedule ?? null;

    if (schedule) {
      actions.named(schedule.does, 'schedule');
    }

    for (const binding of bindings) {
      actions.named(binding.does, `binding on ${binding.event}`);
    }

    for (const offered of offers) {
      if (offered.backing.action !== null) {
        actions.named(offered.backing.action, `tool ${offered.tool}`);
      }
    }

    const connects = input.connects ?? false;
    const holding = input.holding ?? ConnectionHolding.team();

    if (holding.byRequester && !connects) {
      throw new InvalidIntegrationError(
        source.value,
        'takes each person’s connection, and a person can only connect over oauth2',
      );
    }

    return new Integration(
      source,
      (input.name ?? source.value).trim() || source.value,
      webhook,
      poll,
      schedule,
      actions,
      bindings,
      input.credentials ?? [],
      connects,
      holding,
      offers,
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

  bindingFor(event: string): Binding | null {
    return this.bindings.find((each) => each.isFor(event)) ?? null;
  }

  get generatedFrom(): ContentHash | null {
    return (
      this.offers.find((each) => each.backing.described)?.backing.described
        ?.hash ?? null
    );
  }

  takesConnectionFrom(holder: ConnectionHolder): boolean {
    return this.connects && (!holder.isPerson || this.holding.byRequester);
  }

  offered(tool: string): OfferedTool | null {
    return this.offers.find((each) => each.tool === tool) ?? null;
  }

  equals(other: Integration): boolean {
    return this.source.equals(other.source);
  }
}
