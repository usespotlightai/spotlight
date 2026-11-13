import { unscoped } from '@identity/application/ports/workspace-outbound-scope.fake-spec';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import { noFiles } from '@integrations/application/ports/notice-file-reader.fake-spec';
import { NotifyTask } from '@integrations/application/services/notify-task.service';
import { NotifyTeam } from '@integrations/application/services/notify-team.service';
import { TaskNotices } from '@integrations/infrastructure/acl/task-notices.adapter';
import { TeamNotices } from '@integrations/infrastructure/acl/team-notices.adapter';
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
import type { IntegrationTaskViewDto } from '@work/application/dto/integration-task-view.dto';
import type { TaskLinksPort } from '@work/application/ports/task-links.port';
import type { TeamNoticeDto } from '@work/application/ports/team-notices.port';
import { describe, expect, it, vi } from 'vitest';

const taskLinks: TaskLinksPort = {
  taskPage: (slug, teamId, taskId) =>
    `https://app.example/w/${slug}/team/${teamId}/tasks/${taskId}`,
  conversationPage: (slug, conversationId) =>
    `https://app.example/w/${slug}/inbox/${conversationId}`,
  chatPage: (slug, teamId, chatId) =>
    `https://app.example/w/${slug}/team/${teamId}/agent/${chatId}`,
  inboxRequestPage: (slug, inboxRequestId) =>
    `https://app.example/w/${slug}/inbox/${inboxRequestId}`,
  noticePage: (slug, noticeId) =>
    `https://app.example/w/${slug}/inbox/notices/${noticeId}`,
};

const runtimeWith = (outbound: unknown) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(new CelExpressionEngine(), operationsContaining()),
    outbound as HttpOutbound,
    clientsFrom(),
    {} as OAuth2Exchange,
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
  post-request:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      body: '\${{ {"channel": target.channel, "text": task.title + " waits for " + request.form + ": " + string(request.link)} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ response.ts }}'
  post-notice:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      body: '\${{ {"channel": target.channel, "text": notice.headline + "\\n" + notice.points.join("\\n") + (notice.externalLink != null ? "\\n" + notice.externalLink.url : "")} }}'
      expect:
        success: '\${{ response.ok }}'
on:
  inbox-request.opened:
    - action: post-request
      to:
        channel: '\${{ task.marks["slack.channel"] }}'
      routes:
        delivery: C0DELIVERY
      mark:
        - kind: slack.request
          value: '\${{ capture.thread }}'
  notice.raised:
    - action: post-notice
      to:
        channel: '\${{ "C0TEAM" }}'
`;

const ONLY_TASKS = `
integration: slack
actions:
  post:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      body: '\${{ {"channel": target.channel} }}'
on:
  task.asked:
    - action: post
      to:
        channel: '\${{ "C0TEAM" }}'
`;

const finished = (
  marks: Record<string, string> = {},
): IntegrationTaskViewDto => ({
  taskId: 'task_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  title: 'Drain the queue',
  pullRequests: [],
  line: 'delivery',
  station: 'Completed',
  stationKey: 'completed',
  marks,
  waiting: null,
});

const raised = (input: Partial<TeamNoticeDto> = {}): TeamNoticeDto => ({
  id: 'notice_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  form: 'ended',
  headline: 'Spotlight opened a config pull request',
  points: ['Held-out gain: +39 points'],
  externalLink: {
    url: 'https://github.com/acme/config/pull/12',
    label: 'Review the pull request',
  },
  ...input,
});

const notifying = (definition = SLACK) => {
  const run = vi.fn(
    async (
      _action: unknown,
      _against: Record<string, unknown>,
    ): Promise<OutboundResult> => ({
      ok: true,
      status: 200,
      response: { ok: true, ts: '1700.2' },
      capture: { thread: '1700.2' },
    }),
  );
  const warn = vi.fn();
  const args = [
    {
      ofTeam: vi.fn(async () => [defined(definition)]),
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run }),
    callAuthFor(injecting().injection),
    new WebInboxLinks(
      { slugOf: vi.fn(async () => 'acme') } as unknown as WorkspaceReaderPort,
      taskLinks,
    ),
    { warn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  ] as const;

  return {
    tasks: new TaskNotices(new NotifyTask(...args)),
    notices: new TeamNotices(new NotifyTeam(...args)),
    run,
    warn,
  };
};

const sent = (run: ReturnType<typeof notifying>['run']) =>
  run.mock.calls.map(
    ([, against]) => (against as { target: { channel: string } }).target,
  );

const bodyOf = (
  run: ReturnType<typeof notifying>['run'],
): Record<string, unknown> => run.mock.calls[0]?.[1] ?? {};

describe('inbox requests and notices sent to integrations', () => {
  it('posts an inbox request to the channel of its task’s line, with its form and a link to it', async () => {
    const { tasks, run } = notifying();

    await tasks.notifyRequest(finished(), { id: 'request_1', form: 'grade' });

    expect(sent(run)).toEqual([{ channel: 'C0DELIVERY' }]);
    expect(bodyOf(run).request).toEqual({
      form: 'grade',
      link: 'https://app.example/w/acme/inbox/request_1',
    });
    expect((bodyOf(run).task as { title: string }).title).toBe(
      'Drain the queue',
    );
  });

  it('posts an inbox request into the channel its task came from, over the route', async () => {
    const { tasks, run } = notifying();

    await tasks.notifyRequest(finished({ 'slack.channel': 'C0ORIGIN' }), {
      id: 'request_1',
      form: 'memories',
    });

    expect(sent(run)).toEqual([{ channel: 'C0ORIGIN' }]);
  });

  it('hands back the marks an inbox request post captured', async () => {
    const { tasks } = notifying();

    const marks = await tasks.notifyRequest(finished(), {
      id: 'request_1',
      form: 'grade',
    });

    expect(marks).toEqual([{ kind: 'slack.request', value: '1700.2' }]);
  });

  it('gives an inbox request post no question to ask', async () => {
    const { tasks, run } = notifying();

    await tasks.notifyRequest(finished(), { id: 'request_1', form: 'grade' });

    expect(bodyOf(run)).not.toHaveProperty('ask');
  });

  it('posts a notice with its wording, outside link and a link to it', async () => {
    const { notices, run } = notifying();

    await notices.notify(raised());

    expect(sent(run)).toEqual([{ channel: 'C0TEAM' }]);
    expect(bodyOf(run).notice).toEqual({
      form: 'ended',
      headline: 'Spotlight opened a config pull request',
      points: ['Held-out gain: +39 points'],
      link: 'https://app.example/w/acme/inbox/notices/notice_1',
      externalLink: {
        url: 'https://github.com/acme/config/pull/12',
        label: 'Review the pull request',
      },
    });
  });

  it('posts a notice that has no outside link', async () => {
    const { notices, run, warn } = notifying();

    await notices.notify(raised({ externalLink: null }));

    expect(run).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });

  it('posts nothing for an inbox request or a notice the integration does not bind', async () => {
    const { tasks, notices, run } = notifying(ONLY_TASKS);

    await tasks.notifyRequest(finished(), { id: 'request_1', form: 'grade' });
    await notices.notify(raised());

    expect(run).not.toHaveBeenCalled();
  });

  it('logs a notice the service refused', async () => {
    const { notices, run, warn } = notifying();
    run.mockResolvedValueOnce({
      ok: false,
      status: 200,
      response: { ok: false, error: 'channel_not_found' },
      capture: {},
    });

    await notices.notify(raised());

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ notice: 'notice_1' }),
      'A service answered a notice with an error',
    );
  });
});
