import { unscoped } from '@identity/application/ports/workspace-outbound-scope.fake-spec';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import type { Credentials } from '@integrations/application/ports/integration-runtime.port';
import { noFiles } from '@integrations/application/ports/notice-file-reader.fake-spec';
import type { OAuth2ClientsPort } from '@integrations/application/ports/oauth2-clients.port';
import { NotifyChannel } from '@integrations/application/services/notify-channel.service';
import { ChannelNotices } from '@integrations/infrastructure/acl/channel-notices.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import { WebInboxLinks } from '@integrations/infrastructure/links/web-inbox-links';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { noNetwork } from '@integrations/infrastructure/outbound/network-outbound.fake-spec';
import { unlimited } from '@integrations/infrastructure/outbound/outbound-limits.fake-spec';
import { clientsFrom } from '@integrations/integrations.clients.fake-spec';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { operationsContaining } from '@integrations/integrations.documents.fake-spec';
import {
  callingNoServer,
  discoveringNothing,
} from '@integrations/integrations.mcp.fake-spec';
import {
  callAuthFor,
  injecting,
} from '@integrations/integrations.secrets.fake-spec';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { ChannelNoticeDto } from '@work/application/ports/channel-notices.port';
import type { TaskLinksPort } from '@work/application/ports/task-links.port';
import { describe, expect, it, vi } from 'vitest';

const taskLinks: TaskLinksPort = {
  taskPage: (slug, teamId, taskId) =>
    `https://app.example/w/${slug}/team/${teamId}/tasks/${taskId}`,
};

const channelNotices = (...args: ConstructorParameters<typeof NotifyChannel>) =>
  new ChannelNotices(new NotifyChannel(...args));

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2ClientsPort = clientsFrom(),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions, operationsContaining()),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
    discoveringNothing(),
    callingNoServer(),
    unlimited,
    unscoped,
    noNetwork,
    noFiles,
  );

const SLACK = `
integration: slack
actions:
  post-reply:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": reply.link != null ? reply.body + "\\n" + reply.link : reply.body} }}'
      expect:
        success: '\${{ response.ok }}'
on:
  chat.replied:
    - action: post-reply
      to:
        channel: '\${{ chat.marks["slack.channel"] }}'
        thread: '\${{ chat.marks["slack.thread_ts"] }}'
`;

const notice = (input: Partial<ChannelNoticeDto> = {}): ChannelNoticeDto => ({
  workspaceId: 'ws_1',
  teamId: 'team_1',
  marks: [
    { kind: 'slack.thread', value: 'C1:1700.1' },
    { kind: 'slack.channel', value: 'C1' },
    { kind: 'slack.thread_ts', value: '1700.1' },
  ],
  body: 'They time out.',
  proposals: [],
  chatId: 'chat_1',
  taskId: null,
  ...input,
});

const notifying = (definition = SLACK) => {
  const run = vi.fn(
    async (
      _action: unknown,
      _against: Record<string, unknown>,
      _credentials?: Credentials,
    ): Promise<OutboundResult> => ({
      ok: true,
      status: 200,
      response: { ok: true, ts: '1700.2' },
      capture: {},
    }),
  );
  const warn = vi.fn();

  const notices = channelNotices(
    {
      ofTeam: vi.fn(async () => [defined(definition)]),
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    callAuthFor(injecting().injection),
    new WebInboxLinks(
      { slugOf: vi.fn(async () => 'acme') } as unknown as WorkspaceReaderPort,
      taskLinks,
      'https://app.example',
    ),
    { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { notices, run, warn };
};

const posted = (run: ReturnType<typeof notifying>['run']) =>
  run.mock.calls[0]?.[1] as {
    reply: {
      body: string;
      link: string | null;
      proposals: readonly unknown[];
    };
    target: { channel?: string; thread?: string };
  };

describe('ChannelNotices', () => {
  it('posts a reply into the thread of the chat, with a link to the chat', async () => {
    const { notices, run } = notifying();

    await notices.notify(notice(), 'chat.replied');

    const action = posted(run);
    expect(action.target).toEqual({ channel: 'C1', thread: '1700.1' });
    expect(action.reply).toEqual({
      body: 'They time out.',
      link: 'https://app.example/w/acme/team/team_1/agent/chat_1',
      proposals: [],
    });
  });

  it('links the task a reply is about, over the chat', async () => {
    const { notices, run } = notifying();

    await notices.notify(notice({ taskId: 'task_9' }), 'chat.replied');

    expect(posted(run).reply.link).toBe(
      'https://app.example/w/acme/team/team_1/tasks/task_9',
    );
  });

  it('runs each action bound to an event, in order', async () => {
    const { notices, run } = notifying(`${SLACK}  chat.dispatched:
    - action: post-reply
      to:
        channel: '\${{ chat.marks["slack.channel"] }}'
        thread: '\${{ "first" }}'
    - action: post-reply
      to:
        channel: '\${{ chat.marks["slack.channel"] }}'
        thread: '\${{ "second" }}'
`);

    await notices.notify(notice(), 'chat.dispatched');

    expect(
      run.mock.calls.map(
        (each) => (each[1] as { target: { thread: string } }).target.thread,
      ),
    ).toEqual(['first', 'second']);
  });

  it('runs the next action when one fails', async () => {
    const { notices, run, warn } = notifying(`${SLACK}  chat.dispatched:
    - action: post-reply
      to:
        channel: '\${{ chat.marks["slack.channel"] }}'
        thread: '\${{ "first" }}'
    - action: post-reply
      to:
        channel: '\${{ chat.marks["slack.channel"] }}'
        thread: '\${{ "second" }}'
`);
    run.mockRejectedValueOnce(new Error('Slack is down'));

    await notices.notify(notice(), 'chat.dispatched');

    expect(run).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        error: { status: 0, output: 'Slack is down' },
      }),
      'A service answered a chat notice with an error',
    );
  });

  it('gives the open proposals to the action', async () => {
    const { notices, run } = notifying();
    const proposal = { number: 1, title: 'Retry', line: null, station: null };

    await notices.notify(notice({ proposals: [proposal] }), 'chat.replied');

    expect(posted(run).reply.proposals).toEqual([proposal]);
  });

  it('posts nothing for an event the integration does not bind', async () => {
    const { notices, run } = notifying();

    await notices.notify(notice(), 'chat.refused');

    expect(run).not.toHaveBeenCalled();
  });
});
