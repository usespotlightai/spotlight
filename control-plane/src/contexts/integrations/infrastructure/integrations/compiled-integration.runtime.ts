import { createHash } from 'node:crypto';
import { ToolDeclarationMapper } from '@integrations/application/mappers/tool-declaration.mapper';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type {
  Acted,
  BoundTask,
  CallAuth,
  HostError,
  IntegrationRuntimePort,
  Polled,
  Posted,
  Renewed,
  ResolvedTool,
  TaskPayload,
  ToolOutput,
} from '@integrations/application/ports/integration-runtime.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import { ToolAskedMidCallError } from '@integrations/domain/exceptions/tool-asked-mid-call.error';
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
import {
  authorizationServerOf,
  type OAuth2Discovery,
} from '@integrations/infrastructure/integrations/oauth2-discovery';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import {
  asJson,
  textOf,
} from '@integrations/infrastructure/integrations/templating';
import {
  McpQuestionUnsupportedError,
  McpUnauthorizedError,
  mcpReasonOf,
} from '@integrations/infrastructure/mcp/mcp-failures';
import { mcpOutput } from '@integrations/infrastructure/mcp/mcp-output';
import type { McpSessions } from '@integrations/infrastructure/mcp/mcp-sessions';
import { renewingOnce } from '@integrations/infrastructure/mcp/renewing-once';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { operationRequest } from '@integrations/infrastructure/outbound/operation-request';
import { taskBinding } from '@integrations/infrastructure/outbound/task-binding';
import { bound } from '@platform/expressions/bindings';
import { reads, value } from '@platform/expressions/readings';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { TaskMark } from '@work/application/contracts/happenings.contract';

const MAX_OUTPUT_CHARS = 500;

const plainJson = (output: unknown): ToolOutput =>
  JSON.parse(asJson(output ?? null)) as ToolOutput;

const hostErrorOf = (result: OutboundResult): HostError => ({
  status: result.status,
  output: asJson(result.response ?? null).slice(0, MAX_OUTPUT_CHARS),
});

const upstreamErrorUsing = (
  tool: string,
  status: number,
  response: unknown,
): UpstreamError =>
  new UpstreamError(
    `using ${tool}`,
    `the integration answered ${status}: ${asJson(response ?? null).slice(0, MAX_OUTPUT_CHARS)}`,
  );

const fieldOf = (value: unknown, field: string): unknown =>
  typeof value === 'object' && value !== null && field in value
    ? (value as Record<string, unknown>)[field]
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

const versionOf = (token: AccessToken | null): string =>
  token
    ? createHash('sha256').update(token.value).digest('hex').slice(0, 16)
    : 'none';

const failedUsing = (tool: string, server: string, error: unknown): Error => {
  if (error instanceof McpQuestionUnsupportedError) {
    return new ToolAskedMidCallError(tool);
  }

  if (error instanceof UpstreamError || error instanceof EgressBlockedError) {
    return error;
  }

  return new UpstreamError(
    `using ${tool}`,
    mcpReasonOf(error, server),
    error instanceof McpUnauthorizedError ? UNAUTHORIZED : null,
  );
};

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
    private readonly discovery: OAuth2Discovery,
    private readonly sessions: McpSessions,
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
    callAuth: CallAuth,
  ): Promise<Polled> {
    const readable = this.find(definitions, integration.source);
    const poll = readable?.poll;

    if (!readable || !poll) {
      return { kind: 'read', cursor, happenings: [] };
    }

    const { result } = await this.sent(
      poll.request,
      { cursor: cursor ?? '' },
      callAuth,
    );

    if (!result.ok) {
      return { kind: 'failed', error: hostErrorOf(result) };
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
    callAuth: CallAuth,
  ): Promise<Acted> {
    const readable = this.find(definitions, integration.source);
    const schedule = readable?.integration.schedule;
    const request = schedule ? readable?.actions.get(schedule.does) : undefined;

    if (!request) {
      return { kind: 'nothing-to-do' };
    }

    const { result } = await this.sent(request, {}, callAuth);

    return result.ok
      ? { kind: 'done' }
      : { kind: 'failed', error: hostErrorOf(result) };
  }

  async post(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    event: string,
    payload: TaskPayload,
    callAuth: CallAuth,
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

    const against = { task: taskBinding(payload.task), ask: payload.ask };
    const target: Record<string, string> = {};

    for (const each of binding.to) {
      const read = reads(each.value, against);
      if (read !== null) {
        target[each.name] = read;
      }
    }

    if (!target.channel) {
      const routed = binding.routes.get(payload.task.line);
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
      callAuth,
    );

    if (!result.ok) {
      return { kind: 'failed', error: hostErrorOf(result), target };
    }

    const beside = {
      ...bindings,
      response: result.response,
      capture: result.capture,
    };

    const marks: TaskMark[] = [];
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
  ): Promise<ResolvedTool | null> {
    const offering = await this.reader.offering(definitions, tool);

    if (!offering) {
      return null;
    }

    if (!offering.offered.backing.described) {
      return this.written(offering, tool, task);
    }

    return offering.operation?.call.kind === 'mcp'
      ? this.served(offering, tool, task)
      : this.generated(offering, tool);
  }

  private written(
    { readable, offered }: Offering,
    tool: string,
    task: BoundTask,
  ): ResolvedTool | null {
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
      injectedSecrets:
        action.auth?.kind === 'secrets' ? action.auth.secrets : [],
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
      call: async (inputs, callAuth) => {
        const { result, bindings } = await this.sent(
          action,
          { ...bound, inputs },
          callAuth,
        );

        if (!result.ok) {
          throw upstreamErrorUsing(tool, result.status, result.response);
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
  ): ResolvedTool | null {
    const auth = readable.described?.auth ?? null;

    if (!operation) {
      return null;
    }

    return {
      integration: readable.integration,
      offered,
      injectedSecrets: auth?.kind === 'secrets' ? auth.secrets : [],
      declared: ToolDeclarationMapper.toDeclaration(
        offered,
        readable.integration.name,
      ),
      defaultFor: () => undefined,
      call: async (inputs, callAuth) => {
        const request = operationRequest(operation, inputs);
        const connection = callAuth.connection;
        const answering = (token: AccessToken | null) =>
          this.outbound.answer(
            request,
            auth,
            token?.value ?? null,
            callAuth.credentials,
          );
        const first = await answering(connection?.token ?? null);
        const renewed =
          first.status === UNAUTHORIZED && auth?.kind === 'oauth2' && connection
            ? await connection.unauthorized(connection.token)
            : null;
        const answered = renewed ? await answering(renewed) : first;

        if (!answered.ok) {
          throw upstreamErrorUsing(tool, answered.status, answered.response);
        }

        const call = operation.call;

        if (call.kind !== 'graphql') {
          return plainJson(answered.response);
        }

        const errors = graphqlErrorsOf(answered.response);

        if (errors) {
          throw upstreamErrorUsing(tool, answered.status, errors);
        }

        return plainJson(dataOf(answered.response, call.field));
      },
    };
  }

  private served(
    { readable, offered, operation }: Offering,
    tool: string,
    task: BoundTask,
  ): ResolvedTool | null {
    const described = readable.described;
    const call = operation?.call;

    if (!described?.source.url || call?.kind !== 'mcp') {
      return null;
    }

    const server = described.source.url;
    const auth = described.auth;
    const secrets = auth?.kind === 'secrets' ? auth.secrets : [];

    return {
      integration: readable.integration,
      offered,
      injectedSecrets: secrets,
      declared: ToolDeclarationMapper.toDeclaration(
        offered,
        readable.integration.name,
      ),
      defaultFor: () => undefined,
      call: async (inputs, callAuth) => {
        const connection = auth?.kind === 'oauth2' ? callAuth.connection : null;
        const calling = (token: AccessToken | null) =>
          this.sessions.call(
            [
              task.teamId,
              readable.integration.source.value,
              auth?.kind ?? 'none',
              connection?.holder.key ?? 'team',
              versionOf(token),
            ].join(':'),
            server,
            call.tool,
            inputs,
            {
              connection: token?.value ?? null,
              secrets,
              credentials: callAuth.credentials,
            },
          );

        try {
          return mcpOutput(await renewingOnce(calling, connection), tool);
        } catch (error) {
          throw failedUsing(tool, server, error);
        }
      },
    };
  }

  async renew(
    definitions: readonly DefinedIntegration[],
    teamId: TeamId,
    source: SourceKey,
    refreshToken: AccessToken,
  ): Promise<Renewed> {
    const written = this.find(definitions, source)?.connection?.oauth2;
    const oauth2 = written ? await this.discovery.endpoints(written) : null;
    const client = oauth2
      ? await this.clients.existingFor(
          teamId,
          source,
          authorizationServerOf(oauth2),
        )
      : null;

    if (!oauth2 || !client) {
      return { kind: 'unrenewable' };
    }

    const grant = await this.exchange.refresh(
      oauth2,
      client,
      refreshToken.value,
    );

    return grant ? { kind: 'renewed', grant } : { kind: 'failed' };
  }

  private async sent(
    request: RequestIR,
    bindings: Bindings,
    callAuth: CallAuth,
  ): Promise<Sent> {
    const connection = callAuth.connection;
    const first = connected(bindings, connection?.token ?? null);
    const result = await this.outbound.run(
      request,
      first,
      callAuth.credentials,
    );

    if (
      result.status !== UNAUTHORIZED ||
      request.auth?.kind !== 'oauth2' ||
      !connection
    ) {
      return { result, bindings: first };
    }

    const renewed = await connection.unauthorized(connection.token);

    if (!renewed) {
      return { result, bindings: first };
    }

    const again = connected(bindings, renewed);

    return {
      result: await this.outbound.run(request, again, callAuth.credentials),
      bindings: again,
    };
  }

  private readable(
    definitions: readonly DefinedIntegration[],
  ): readonly ReadableIntegration[] {
    const cached = this.#read.get(definitions);

    if (cached) {
      return cached;
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
