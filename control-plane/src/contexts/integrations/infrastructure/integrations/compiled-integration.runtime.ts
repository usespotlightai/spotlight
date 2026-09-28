import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type {
  Acted,
  BoundTask,
  HostRefusal,
  IntegrationRuntimePort,
  Polled,
  Posted,
  Reach,
  ReachableTool,
  Renewed,
  TaskWord,
  ToolOutput,
} from '@integrations/application/ports/integration-runtime.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { readEvents } from '@integrations/infrastructure/integrations/happenings';
import type { ReadableIntegration } from '@integrations/infrastructure/integrations/integration.compile';
import type { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import {
  asJson,
  textOf,
} from '@integrations/infrastructure/integrations/templating';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { taskBinding } from '@integrations/infrastructure/outbound/task-binding';
import { bound } from '@platform/expressions/bindings';
import { reads, value } from '@platform/expressions/readings';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import type { MarkWorn } from '@work/application/contracts/happenings.contract';

const SAID_AT_MOST = 500;

const plainJson = (output: unknown): ToolOutput =>
  JSON.parse(asJson(output ?? null)) as ToolOutput;

const refusalOf = (result: OutboundResult): HostRefusal => ({
  status: result.status,
  said: asJson(result.response ?? null).slice(0, SAID_AT_MOST),
});

const reached = (reach: Reach) =>
  reach.connection ? { connection: reach.connection.value } : {};

export class CompiledIntegrationRuntime implements IntegrationRuntimePort {
  readonly #read = new WeakMap<
    readonly DefinedIntegration[],
    readonly ReadableIntegration[]
  >();

  constructor(
    private readonly reader: IntegrationReader,
    private readonly outbound: HttpOutbound,
    private readonly clients: OAuth2Clients,
    private readonly exchange: OAuth2Exchange,
  ) {}

  integrations(
    definitions: readonly DefinedIntegration[],
  ): readonly Integration[] {
    return this.readable(definitions).map((each) => each.integration);
  }

  async poll(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    cursor: string | null,
    reach: Reach,
  ): Promise<Polled> {
    const readable = this.find(definitions, integration.source);
    const poll = readable?.poll;

    if (!readable || !poll) {
      return { kind: 'read', cursor, happenings: [] };
    }

    const result = await this.outbound.run(
      poll.request,
      { cursor: cursor ?? '', ...reached(reach) },
      reach.credentials,
    );

    if (!result.ok) {
      return { kind: 'refused', refusal: refusalOf(result) };
    }

    const against = { body: bound(result.response), cursor: cursor ?? '' };

    const happenings = await readEvents(
      poll.events,
      (happening) =>
        readable.integration.declares.find(
          (each) => each.happening.value === happening,
        ) ?? null,
      against,
      () => false,
    );

    return {
      kind: 'read',
      cursor: poll.cursor ? reads(poll.cursor, against) : cursor,
      happenings,
    };
  }

  async runSchedule(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    reach: Reach,
  ): Promise<Acted> {
    const readable = this.find(definitions, integration.source);
    const schedule = readable?.integration.schedule;
    const request = schedule ? readable?.actions.get(schedule.does) : undefined;

    if (!request) {
      return { kind: 'nothing-to-do' };
    }

    const result = await this.outbound.run(
      request,
      reached(reach),
      reach.credentials,
    );

    return result.ok
      ? { kind: 'done' }
      : { kind: 'refused', refusal: refusalOf(result) };
  }

  async post(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    event: string,
    word: TaskWord,
    reach: Reach,
  ): Promise<Posted> {
    const readable = this.find(definitions, integration.source);
    const bound = readable?.integration.bindingFor(event);
    const binding = bound
      ? readable?.on.find((each) => each.event === bound.event)
      : undefined;
    const action = bound ? readable?.actions.get(bound.does) : undefined;

    if (!binding || !action) {
      return { kind: 'unaddressed' };
    }

    const against = { task: taskBinding(word.task), ask: word.ask };
    const target: Record<string, string> = {};

    for (const each of binding.to) {
      const read = reads(each.value, against);
      if (read !== null) {
        target[each.name] = read;
      }
    }

    if (!target.channel) {
      const routed = binding.routes.get(word.task.line);
      if (routed) {
        target.channel = routed;
      }
    }

    if (!target.channel && !target.thread) {
      return { kind: 'unaddressed' };
    }

    const bindings = { ...against, target, ...reached(reach) };
    const result = await this.outbound.run(action, bindings, reach.credentials);

    if (!result.ok) {
      return { kind: 'refused', refusal: refusalOf(result), target };
    }

    const beside = {
      ...bindings,
      response: result.response,
      capture: result.capture,
    };

    const marks: MarkWorn[] = [];
    for (const mark of binding.mark) {
      const read = reads(mark.value, beside);
      if (read) {
        marks.push({ kind: mark.kind.value, value: read });
      }
    }

    return { kind: 'posted', marks };
  }

  tool(
    definitions: readonly DefinedIntegration[],
    tool: string,
    task: BoundTask,
  ): ReachableTool | null {
    const readable = this.readable(definitions).find(
      (each) => each.integration.offered(tool) !== null,
    );
    const declared = readable?.integration.offered(tool) ?? null;
    const compiled = declared ? readable?.tools.get(declared.name) : undefined;
    const action = declared ? readable?.actions.get(declared.does) : undefined;

    if (!declared || !readable || !compiled || !action) {
      return null;
    }

    const bound = { task: taskBinding(task) };

    return {
      integration: readable.integration,
      offered: declared,
      wears: action.auth?.kind === 'secrets' ? action.auth.secrets : [],
      declared: {
        tool: declared.tool,
        description: declared.description,
        inputs: declared.inputs,
        approval: declared.approval
          ? { because: declared.approval.because }
          : null,
      },
      defaultFor: (input) => {
        const written = compiled.inputs.find(
          (each) => each.name === input.name,
        )?.default;
        return written ? textOf(written, bound) : undefined;
      },
      call: async (inputs, reach) => {
        const bindings = { ...bound, inputs, ...reached(reach) };
        const result = await this.outbound.run(
          action,
          bindings,
          reach.credentials,
        );

        if (!result.ok) {
          throw new UpstreamRefusedError(
            `using ${tool}`,
            `the integration answered ${result.status}: ${asJson(result.response ?? null).slice(0, 500)}`,
          );
        }

        return plainJson(
          compiled.output
            ? value(compiled.output, {
                ...bindings,
                response: result.response,
                status: result.status,
                capture: result.capture,
              })
            : result.capture,
        );
      },
    };
  }

  async renew(
    definitions: readonly DefinedIntegration[],
    source: SourceKey,
    refreshToken: AccessToken,
  ): Promise<Renewed> {
    const oauth2 = this.find(definitions, source)?.connection?.oauth2;
    const client = this.clients.of(source.value);

    if (!oauth2 || !client) {
      return { kind: 'unrenewable' };
    }

    const grant = await this.exchange.refresh(
      oauth2,
      client,
      refreshToken.value,
    );

    return grant ? { kind: 'renewed', grant } : { kind: 'refused' };
  }

  private readable(
    definitions: readonly DefinedIntegration[],
  ): readonly ReadableIntegration[] {
    const held = this.#read.get(definitions);

    if (held) {
      return held;
    }

    const read = this.reader.readable(definitions).integrations;
    this.#read.set(definitions, read);

    return read;
  }

  private find(
    definitions: readonly DefinedIntegration[],
    source: SourceKey,
  ): ReadableIntegration | undefined {
    return this.readable(definitions).find((each) =>
      each.integration.source.equals(source),
    );
  }
}
