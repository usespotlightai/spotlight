import { createHash } from 'node:crypto';
import { ToolDeclarationMapper } from '@integrations/application/mappers/tool-declaration.mapper';
import type { DefinedIntegration } from '@integrations/application/ports/defined-integrations.port';
import type {
  ActionResult,
  CallAuth,
  IntegrationRuntimePort,
  IntegrationTaskView,
  NoticePayload,
  PollResult,
  PostResult,
  RefreshResult,
  ResolvedTool,
  ServiceError,
  ToolOutput,
} from '@integrations/application/ports/integration-runtime.port';
import type { NoticeFileReaderPort } from '@integrations/application/ports/notice-file-reader.port';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import type { OutboundLimitsPort } from '@integrations/application/ports/outbound-limits.port';
import type { Integration } from '@integrations/domain/entities/integration.entity';
import { EgressBlockedError } from '@integrations/domain/exceptions/egress-blocked.error';
import { ToolAskedMidCallError } from '@integrations/domain/exceptions/tool-asked-mid-call.error';
import type { AccessToken } from '@integrations/domain/value-objects/access-token.vo';
import type { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { readEvents } from '@integrations/infrastructure/integrations/happenings';
import type {
  OnBindingIR,
  ReadableIntegration,
  ReadyIR,
  RequestIR,
  UploadsIR,
} from '@integrations/infrastructure/integrations/integration.compile';
import type {
  FoundTool,
  IntegrationReader,
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
import { refreshingOnce } from '@integrations/infrastructure/mcp/refreshing-once';
import type {
  HttpOutbound,
  OutboundResult,
  SentFile,
} from '@integrations/infrastructure/outbound/http-outbound';
import type { NetworkOutbound } from '@integrations/infrastructure/outbound/network-outbound';
import { operationRequest } from '@integrations/infrastructure/outbound/operation-request';
import { taskBinding } from '@integrations/infrastructure/outbound/task-binding';
import { sanitizedForCel } from '@platform/expressions/cel-variables';
import { evaluateText, value } from '@platform/expressions/readings';
import { type Sleep, sleeping } from '@platform/time/sleep';
import type { WorkspaceOutboundScopePort } from '@shared-kernel/application/ports/workspace-outbound-scope.port';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskMark } from '@work/application/contracts/happenings.contract';

const MAX_OUTPUT_CHARS = 500;

const plainJson = (output: unknown): ToolOutput =>
  JSON.parse(asJson(output ?? null)) as ToolOutput;

const serviceErrorOf = (result: OutboundResult): ServiceError => ({
  status: result.status,
  output: asJson(result.response ?? null).slice(0, MAX_OUTPUT_CHARS),
});

const reasonOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

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

const READY_EVERY_MS = 1_000;

type Bindings = Record<string, unknown>;

interface Uploads {
  readonly uploaded: readonly Record<string, unknown>[];
  readonly failed: ServiceError | null;
}

type Attempt =
  | { readonly kind: 'sent'; readonly sent: Sent }
  | {
      readonly kind: 'failed';
      readonly error: ServiceError;
      readonly answered: boolean;
    };

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
    private readonly limits: OutboundLimitsPort,
    private readonly scope: WorkspaceOutboundScopePort,
    private readonly network: NetworkOutbound,
    private readonly files: NoticeFileReaderPort,
    private readonly sleep: Sleep = sleeping,
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
  ): Promise<PollResult> {
    const readable = this.find(definitions, integration.key);
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
      return { kind: 'failed', error: serviceErrorOf(result) };
    }

    const against = {
      body: sanitizedForCel(result.response),
      cursor: cursor ?? '',
    };

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
      cursor: poll.cursor ? evaluateText(poll.cursor, against) : cursor,
      happenings,
    };
  }

  async runSchedule(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    callAuth: CallAuth,
  ): Promise<ActionResult> {
    const readable = this.find(definitions, integration.key);
    const schedule = readable?.integration.schedule;
    const request = schedule
      ? readable?.actions.get(schedule.action)
      : undefined;

    if (!request) {
      return { kind: 'nothing-to-do' };
    }

    const { result } = await this.sent(request, {}, callAuth);

    return result.ok
      ? { kind: 'done' }
      : { kind: 'failed', error: serviceErrorOf(result) };
  }

  async post(
    definitions: readonly DefinedIntegration[],
    integration: Integration,
    event: string,
    payload: NoticePayload,
    callAuth: CallAuth,
  ): Promise<readonly PostResult[]> {
    const readable = this.find(definitions, integration.key);

    const results: PostResult[] = [];

    for (const binding of readable?.on ?? []) {
      if (readable && binding.event === event) {
        results.push(
          ...(await this.posted(readable, binding, payload, callAuth)),
        );
      }
    }

    return results;
  }

  private async posted(
    readable: ReadableIntegration,
    binding: OnBindingIR,
    payload: NoticePayload,
    callAuth: CallAuth,
  ): Promise<readonly PostResult[]> {
    const action = readable.actions.get(binding.action);

    if (!action) {
      return [{ kind: 'unaddressed' }];
    }

    const against =
      'task' in payload
        ? { task: taskBinding(payload.task), ask: payload.ask }
        : { chat: payload.chat, reply: payload.reply };
    const target: Record<string, string> = {};

    for (const each of binding.to) {
      const read = evaluateText(each.value, against);
      if (read !== null) {
        target[each.name] = read;
      }
    }

    if (!target.channel && 'task' in payload) {
      const routed = binding.routes.get(payload.task.line);
      if (routed) {
        target.channel = routed;
      }
    }

    if (!target.channel && !target.thread) {
      return [{ kind: 'unaddressed' }];
    }

    const addressed = { ...against, target };
    const uploads = action.uploads
      ? await this.uploaded(action.uploads, addressed, payload, callAuth)
      : { uploaded: [], failed: null };
    const unsent: PostResult[] = uploads.failed
      ? [{ kind: 'failed', error: uploads.failed, target }]
      : [];

    const first = await this.attempted(
      action,
      { ...addressed, uploaded: uploads.uploaded },
      callAuth,
    );
    const answered =
      first.kind === 'failed' && first.answered && uploads.uploaded.length > 0
        ? await this.attempted(action, { ...addressed, uploaded: [] }, callAuth)
        : first;
    const refused: PostResult[] =
      first.kind === 'failed' && answered !== first
        ? [{ kind: 'failed', error: first.error, target }]
        : [];

    if (answered.kind === 'failed') {
      return [
        ...unsent,
        ...refused,
        { kind: 'failed', error: answered.error, target },
      ];
    }

    const { result, bindings } = answered.sent;

    const beside = {
      ...bindings,
      response: result.response,
      capture: result.capture,
    };

    const marks: TaskMark[] = [];
    for (const mark of binding.mark) {
      const read = evaluateText(mark.value, beside);
      if (read) {
        marks.push({ kind: mark.kind.value, value: read });
      }
    }

    return [...unsent, ...refused, { kind: 'posted', marks }];
  }

  private async attempted(
    action: RequestIR,
    bindings: Bindings,
    callAuth: CallAuth,
  ): Promise<Attempt> {
    try {
      const sent = await this.sent(action, bindings, callAuth);

      return sent.result.ok
        ? { kind: 'sent', sent }
        : {
            kind: 'failed',
            error: serviceErrorOf(sent.result),
            answered: true,
          };
    } catch (error) {
      return {
        kind: 'failed',
        error: { status: 0, output: reasonOf(error) },
        answered: false,
      };
    }
  }

  private async uploaded(
    uploads: UploadsIR,
    bindings: Bindings,
    payload: NoticePayload,
    callAuth: CallAuth,
  ): Promise<Uploads> {
    const listed = value(uploads.each, bindings);
    const files = 'task' in payload ? payload.ask.attachments : [];
    const ids = new Set(
      (Array.isArray(listed) ? listed : []).map((item) => fieldOf(item, 'id')),
    );
    const chosen = files.filter((file) => ids.has(file.id));

    if (chosen.length === 0 || !('task' in payload)) {
      return { uploaded: [], failed: null };
    }

    const uploaded: Record<string, unknown>[] = [];

    try {
      for (const file of chosen) {
        const per = { ...bindings, file };
        const prepared = await this.sent(uploads.prepare, per, callAuth);

        if (!prepared.result.ok) {
          return { uploaded: [], failed: serviceErrorOf(prepared.result) };
        }

        const bytes = await this.files.open(payload.task.taskId, file.id);

        if (!bytes) {
          return {
            uploaded: [],
            failed: {
              status: 0,
              output: `the file ${file.name} is no longer on the task`,
            },
          };
        }

        const sent = await this.onBehalfOf(callAuth, () =>
          this.sentInScope(
            uploads.send,
            { ...per, prepared: prepared.result.capture },
            callAuth,
            { bytes, type: file.type },
          ),
        );

        if (!sent.result.ok) {
          return { uploaded: [], failed: serviceErrorOf(sent.result) };
        }

        uploaded.push({ ...file, prepared: prepared.result.capture });
      }

      if (uploads.complete) {
        const completed = await this.sent(
          uploads.complete,
          { ...bindings, uploaded },
          callAuth,
        );

        if (!completed.result.ok) {
          return { uploaded: [], failed: serviceErrorOf(completed.result) };
        }
      }

      const ready = uploads.ready;
      if (ready) {
        const unready = await Promise.all(
          uploaded.map((each) =>
            this.unready(
              ready,
              { ...bindings, file: each, prepared: each.prepared },
              callAuth,
            ),
          ),
        );
        const failed = unready.find((each) => each !== null);

        if (failed) {
          return { uploaded: [], failed };
        }
      }
    } catch (error) {
      return {
        uploaded: [],
        failed: { status: 0, output: reasonOf(error) },
      };
    }

    return { uploaded, failed: null };
  }

  private async unready(
    ready: ReadyIR,
    bindings: Bindings,
    callAuth: CallAuth,
  ): Promise<ServiceError | null> {
    const name = fieldOf(bindings.file, 'name');

    for (let attempt = 1; ; attempt++) {
      const checked = await this.sent(ready, bindings, callAuth).then(
        (sent) => (sent.result.ok ? null : serviceErrorOf(sent.result)),
        (error: unknown): ServiceError => ({
          status: 0,
          output: reasonOf(error),
        }),
      );

      if (!checked) {
        return null;
      }

      if (attempt >= ready.attempts) {
        return {
          status: checked.status,
          output: `the file ${String(name)} was not ready after ${ready.attempts} attempts: ${checked.output}`,
        };
      }

      await this.sleep(READY_EVERY_MS);
    }
  }

  async tool(
    definitions: readonly DefinedIntegration[],
    tool: string,
    task: IntegrationTaskView,
  ): Promise<ResolvedTool | null> {
    const provided = await this.reader.providedTool(definitions, tool);

    if (!provided) {
      return null;
    }

    if (!provided.tool.backing.spec) {
      return this.written(provided, tool, task);
    }

    return provided.operation?.call.kind === 'mcp'
      ? this.served(provided, tool, task)
      : this.generated(provided, tool);
  }

  private written(
    { readable, tool: provided }: FoundTool,
    tool: string,
    task: IntegrationTaskView,
  ): ResolvedTool | null {
    const compiled = readable.tools.get(provided.name);
    const action = provided.backing.action
      ? readable.actions.get(provided.backing.action)
      : undefined;

    if (!compiled || !action) {
      return null;
    }

    const bound = { task: taskBinding(task) };

    return {
      integration: readable.integration,
      provided,
      injectedSecrets:
        action.auth?.kind === 'secrets' ? action.auth.secrets : [],
      declared: ToolDeclarationMapper.toDeclaration(
        provided,
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
    { readable, tool: provided, operation }: FoundTool,
    tool: string,
  ): ResolvedTool | null {
    const auth = readable.apiSpec?.auth ?? null;

    if (!operation) {
      return null;
    }

    return {
      integration: readable.integration,
      provided,
      injectedSecrets: auth?.kind === 'secrets' ? auth.secrets : [],
      declared: ToolDeclarationMapper.toDeclaration(
        provided,
        readable.integration.name,
      ),
      defaultFor: () => undefined,
      call: (inputs, callAuth) =>
        this.onBehalfOf(callAuth, async () => {
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
          const refreshed =
            first.status === UNAUTHORIZED &&
            auth?.kind === 'oauth2' &&
            connection
              ? await connection.unauthorized(connection.token)
              : null;
          const answered = refreshed ? await answering(refreshed) : first;

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
        }),
    };
  }

  private served(
    { readable, tool: provided, operation }: FoundTool,
    tool: string,
    task: IntegrationTaskView,
  ): ResolvedTool | null {
    const apiSpec = readable.apiSpec;
    const call = operation?.call;

    if (!apiSpec?.spec.url || call?.kind !== 'mcp') {
      return null;
    }

    const server = apiSpec.spec.url;
    const auth = apiSpec.auth;
    const secrets = auth?.kind === 'secrets' ? auth.secrets : [];

    return {
      integration: readable.integration,
      provided,
      injectedSecrets: secrets,
      declared: ToolDeclarationMapper.toDeclaration(
        provided,
        readable.integration.name,
      ),
      defaultFor: () => undefined,
      call: (inputs, callAuth) =>
        this.onBehalfOf(callAuth, async () => {
          const connection =
            auth?.kind === 'oauth2' ? callAuth.connection : null;
          const calling = (token: AccessToken | null) =>
            this.sessions.call(
              [
                task.teamId,
                readable.integration.key.value,
                auth?.kind ?? 'none',
                connection?.owner.key ?? 'team',
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
            return mcpOutput(await refreshingOnce(calling, connection), tool);
          } catch (error) {
            throw failedUsing(tool, server, error);
          }
        }),
    };
  }

  async refresh(
    definitions: readonly DefinedIntegration[],
    owner: { readonly teamId: TeamId; readonly workspaceId: WorkspaceId },
    integration: IntegrationKey,
    refreshToken: AccessToken,
  ): Promise<RefreshResult> {
    return this.scope.within(owner.workspaceId.value, () =>
      this.refreshInScope(definitions, owner.teamId, integration, refreshToken),
    );
  }

  private async refreshInScope(
    definitions: readonly DefinedIntegration[],
    teamId: TeamId,
    integration: IntegrationKey,
    refreshToken: AccessToken,
  ): Promise<RefreshResult> {
    const written = this.find(definitions, integration)?.connection?.oauth2;
    const oauth2 = written ? await this.discovery.endpoints(written) : null;
    const client = oauth2
      ? await this.clients.existingFor(
          teamId,
          integration,
          authorizationServerOf(oauth2),
        )
      : null;

    if (!oauth2 || !client) {
      return { kind: 'not-refreshable' };
    }

    const tokens = await this.exchange.refresh(
      oauth2,
      client,
      refreshToken.value,
    );

    return tokens ? { kind: 'refreshed', tokens } : { kind: 'failed' };
  }

  private sent(
    request: RequestIR,
    bindings: Bindings,
    callAuth: CallAuth,
  ): Promise<Sent> {
    const network = request.fromNetwork;

    if (network) {
      return this.sentFromNetwork(
        request,
        network.timeoutMs,
        bindings,
        callAuth,
      );
    }

    return this.onBehalfOf(callAuth, () =>
      this.sentInScope(request, bindings, callAuth),
    );
  }

  private async sentFromNetwork(
    request: RequestIR,
    timeoutMs: number,
    bindings: Bindings,
    callAuth: CallAuth,
  ): Promise<Sent> {
    const workspace = await this.limited(callAuth);

    return {
      result: await this.network.run(
        request,
        bindings,
        callAuth.credentials,
        workspace,
        timeoutMs,
      ),
      bindings,
    };
  }

  private async sentInScope(
    request: RequestIR,
    bindings: Bindings,
    callAuth: CallAuth,
    file?: SentFile,
  ): Promise<Sent> {
    const call = (against: Bindings) =>
      file
        ? this.outbound.upload(request, against, callAuth.credentials, file)
        : this.outbound.run(request, against, callAuth.credentials);
    const connection = callAuth.connection;
    const first = connected(bindings, connection?.token ?? null);
    const result = await call(first);

    if (
      result.status !== UNAUTHORIZED ||
      request.auth?.kind !== 'oauth2' ||
      !connection
    ) {
      return { result, bindings: first };
    }

    const refreshed = await connection.unauthorized(connection.token);

    if (!refreshed) {
      return { result, bindings: first };
    }

    const again = connected(bindings, refreshed);

    return {
      result: await call(again),
      bindings: again,
    };
  }

  private async onBehalfOf<T>(
    callAuth: CallAuth,
    work: () => Promise<T>,
  ): Promise<T> {
    return this.scope.within(await this.limited(callAuth), work);
  }

  private async limited(callAuth: CallAuth): Promise<string> {
    const workspace = await callAuth.workspace();

    if (!(await this.limits.take(workspace))) {
      throw new UpstreamError(
        'calling a service',
        `this workspace sends more than ${this.limits.perSecond} requests each second to other services`,
      );
    }

    return workspace;
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
    integration: IntegrationKey,
  ): ReadableIntegration | undefined {
    return this.readable(definitions).find((each) =>
      each.integration.key.equals(integration),
    );
  }
}
