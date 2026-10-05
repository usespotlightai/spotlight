import { ToolDeclarationMapper } from '@integrations/application/mappers/tool-declaration.mapper';
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
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { readEvents } from '@integrations/infrastructure/integrations/happenings';
import type {
  ReadableIntegration,
  RequestIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import type {
  IntegrationReader,
  Offering,
} from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import {
  asJson,
  textOf,
} from '@integrations/infrastructure/integrations/templating';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { operationRequest } from '@integrations/infrastructure/outbound/operation-request';
import { taskBinding } from '@integrations/infrastructure/outbound/task-binding';
import { bound } from '@platform/expressions/bindings';
import { reads, value } from '@platform/expressions/readings';
import { UpstreamRefusedError } from '@shared-kernel/domain/exceptions/upstream-refused.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { MarkWorn } from '@work/application/contracts/happenings.contract';

const SAID_AT_MOST = 500;

const plainJson = (output: unknown): ToolOutput =>
  JSON.parse(asJson(output ?? null)) as ToolOutput;

const refusalOf = (result: OutboundResult): HostRefusal => ({
  status: result.status,
  said: asJson(result.response ?? null).slice(0, SAID_AT_MOST),
});

const refusedUsing = (
  tool: string,
  status: number,
  response: unknown,
): UpstreamRefusedError =>
  new UpstreamRefusedError(
    `using ${tool}`,
    `the integration answered ${status}: ${asJson(response ?? null).slice(0, SAID_AT_MOST)}`,
  );

const fieldOf = (held: unknown, field: string): unknown =>
  typeof held === 'object' && held !== null && field in held
    ? (held as Record<string, unknown>)[field]
    : undefined;

const graphqlErrorsOf = (response: unknown): unknown => {
  const errors = fieldOf(response, 'errors');

  return Array.isArray(errors) && errors.length > 0 ? errors : null;
};

const dataOf = (response: unknown, field: string): unknown =>
  fieldOf(fieldOf(response, 'data'), field) ?? null;

const UNAUTHORIZED = 401;

type Bindings = Record<string, unknown>;

interface Sent {
  readonly result: OutboundResult;
  readonly bindings: Bindings;
}

const connected = (bindings: Bindings, token: AccessToken | null): Bindings =>
  token ? { ...bindings, connection: token.value } : bindings;

export class CompiledIntegrationRuntime implements IntegrationRuntimePort {
  readonly #read = new WeakMap<
    readonly DefinedIntegration[],
    readonly ReadableIntegration[]
  >();

  constructor(
    private readonly reader: IntegrationReader,
    private readonly outbound: HttpOutbound,
    private readonly clients: OAuth2ClientsPort,
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

    const { result } = await this.sent(
      poll.request,
      { cursor: cursor ?? '' },
      reach,
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

    const { result } = await this.sent(request, {}, reach);

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

    const { result, bindings } = await this.sent(
      action,
      { ...against, target },
      reach,
    );

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

  async tool(
    definitions: readonly DefinedIntegration[],
    tool: string,
    task: BoundTask,
  ): Promise<ReachableTool | null> {
    const offering = await this.reader.offering(definitions, tool);

    if (!offering) {
      return null;
    }

    return offering.offered.backing.described
      ? this.generated(offering, tool)
      : this.written(offering, tool, task);
  }

  private written(
    { readable, offered }: Offering,
    tool: string,
    task: BoundTask,
  ): ReachableTool | null {
    const compiled = readable.tools.get(offered.name);
    const action = offered.backing.action
      ? readable.actions.get(offered.backing.action)
      : undefined;

    if (!compiled || !action) {
      return null;
    }

    const bound = { task: taskBinding(task) };

    return {
      integration: readable.integration,
      offered,
      wears: action.auth?.kind === 'secrets' ? action.auth.secrets : [],
      declared: ToolDeclarationMapper.toDeclaration(
        offered,
        readable.integration.name,
      ),
      defaultFor: (input) => {
        const written = compiled.inputs.find(
          (each) => each.name === input,
        )?.default;
        return written ? textOf(written, bound) : undefined;
      },
      call: async (inputs, reach) => {
        const { result, bindings } = await this.sent(
          action,
          { ...bound, inputs },
          reach,
        );

        if (!result.ok) {
          throw refusedUsing(tool, result.status, result.response);
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

  private generated(
    { readable, offered, operation }: Offering,
    tool: string,
  ): ReachableTool | null {
    const auth = readable.described?.auth ?? null;

    if (!operation) {
      return null;
    }

    return {
      integration: readable.integration,
      offered,
      wears: auth?.kind === 'secrets' ? auth.secrets : [],
      declared: ToolDeclarationMapper.toDeclaration(
        offered,
        readable.integration.name,
      ),
      defaultFor: () => undefined,
      call: async (inputs, reach) => {
        const request = operationRequest(operation, inputs);
        const held = reach.connection;
        const answering = (token: AccessToken | null) =>
          this.outbound.answer(
            request,
            auth,
            token?.value ?? null,
            reach.credentials,
          );
        const first = await answering(held?.token ?? null);
        const renewed =
          first.status === UNAUTHORIZED && auth?.kind === 'oauth2' && held
            ? await held.refused(held.token)
            : null;
        const answered = renewed ? await answering(renewed) : first;

        if (!answered.ok) {
          throw refusedUsing(tool, answered.status, answered.response);
        }

        if (operation.call.kind === 'http') {
          return plainJson(answered.response);
        }

        const errors = graphqlErrorsOf(answered.response);

        if (errors) {
          throw refusedUsing(tool, answered.status, errors);
        }

        return plainJson(dataOf(answered.response, operation.call.field));
      },
    };
  }

  async renew(
    definitions: readonly DefinedIntegration[],
    teamId: TeamId,
    source: SourceKey,
    refreshToken: AccessToken,
  ): Promise<Renewed> {
    const oauth2 = this.find(definitions, source)?.connection?.oauth2;
    const client = oauth2 ? await this.clients.heldFor(teamId, source) : null;

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

  private async sent(
    request: RequestIR,
    bindings: Bindings,
    reach: Reach,
  ): Promise<Sent> {
    const held = reach.connection;
    const first = connected(bindings, held?.token ?? null);
    const result = await this.outbound.run(request, first, reach.credentials);

    if (
      result.status !== UNAUTHORIZED ||
      request.auth?.kind !== 'oauth2' ||
      !held
    ) {
      return { result, bindings: first };
    }

    const renewed = await held.refused(held.token);

    if (!renewed) {
      return { result, bindings: first };
    }

    const again = connected(bindings, renewed);

    return {
      result: await this.outbound.run(request, again, reach.credentials),
      bindings: again,
    };
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
