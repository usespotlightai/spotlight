import type { HeldSecretsPort } from '@configuration/application/ports/held-secrets.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { DefinedIntegrationsPort } from '@integrations/application/ports/defined-integrations.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { TaskNotices } from '@integrations/infrastructure/acl/task-notices.adapter';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { defined } from '@integrations/integrations.definitions.fake-spec';
import { WebInboxLinks } from '@integrations/presentation/http/web-inbox-links';
import { CelExpressionEngine } from '@platform/expressions/cel-expression.engine';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import { describe, expect, it, vi } from 'vitest';

const expressions = new CelExpressionEngine();

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2Clients = OAuth2Clients.from('{}'),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(expressions),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
  );

const _NOW = new Date('2026-09-07T10:00:00.000Z');

const slack = (headers = '') => `
integration: slack
actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
${headers}      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": ask.body} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ response.ts }}'
  acknowledge:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
${headers}      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": dyn("On it.")} }}'
      expect:
        success: '\${{ response.ok }}'
on:
  task.opened:
    do: acknowledge
    to:
      channel: '\${{ task.marks["slack.channel"] }}'
      thread: '\${{ task.marks["slack.thread"] }}'
    routes:
      delivery: C0DELIVERY
  task.asked:
    do: post-message
    to:
      channel: '\${{ task.marks["slack.channel"] }}'
      thread: '\${{ task.marks["slack.thread"] }}'
    routes:
      delivery: C0DELIVERY
    mark:
      - kind: slack.thread
        value: '\${{ capture.thread }}'
`;

const READS_A_SECRET = `      headers:
        authorization: '\${{ "Bearer " + secret.SLACK_BOT_TOKEN }}'
`;

const asked = (
  marks: Record<string, string> = {},
  awaitsApproval = false,
): BoundTaskDto => ({
  taskId: 'task_1',
  workspaceId: 'ws_1',
  teamId: 'team_1',
  line: 'delivery',
  station: 'Triage',
  stationKey: 'triage',
  marks,
  waiting: {
    conversationId: 'task_1:1',
    said: 'Which queue should I drain?',
    awaitsApproval,
  },
});

const notifying = (
  reply: OutboundResult = {
    ok: true,
    status: 200,
    response: { ok: true, ts: '170.9' },
    capture: { thread: '170.9' },
  },
  file = slack(),
) => {
  const run = vi.fn(
    async (_action: unknown, _against: Record<string, unknown>) => reply,
  );

  const notifier = new TaskNotices(
    {
      ofTeam: vi.fn(async () => [defined(file)]),
    } as unknown as DefinedIntegrationsPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    new HostReach({ held: async () => [] } satisfies HeldSecretsPort, {
      of: async () => null,
    } as unknown as HostConnectionRepository),
    new WebInboxLinks(
      { slugOf: vi.fn(async () => 'acme') } as unknown as WorkspaceReaderPort,
      'https://app.example',
    ),
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { notifier, run };
};

describe('TaskNotices', () => {
  it('posts a routed line’s ask to its channel, with the ask body and a link', async () => {
    const { notifier, run } = notifying();

    await notifier.notify(asked(), 'task.asked');

    const action = run.mock.calls[0]?.[1] as {
      ask: { body: string; link: string };
      target: { channel?: string; thread?: string };
    };
    expect(action.target.channel).toBe('C0DELIVERY');
    expect(action.target.thread).toBeUndefined();
    expect(action.ask.body).toBe('Which queue should I drain?');
    expect(action.ask.link).toContain('/w/acme/inbox/task_1:');
  });

  it('tells a host where to approve or reject a tool call, since it cannot be decided there', async () => {
    const { notifier, run } = notifying();

    await notifier.notify(asked({}, true), 'task.asked');

    const action = run.mock.calls[0]?.[1] as { ask: { body: string } };
    expect(action.ask.body).toBe(
      'Which queue should I drain?\n\nApprove or reject it in Spotlight: https://app.example/w/acme/inbox/task_1:1',
    );
  });

  it('posts into the origin thread when the task carries one, over the route', async () => {
    const { notifier, run } = notifying();

    await notifier.notify(
      asked({ 'slack.thread': '170.1', 'slack.channel': 'C0REQ' }),
      'task.asked',
    );

    const action = run.mock.calls[0]?.[1] as {
      target: { channel?: string; thread?: string };
    };
    expect(action.target.channel).toBe('C0REQ');
    expect(action.target.thread).toBe('170.1');
  });

  it('hands back the thread it captured, for the caller to record', async () => {
    const { notifier } = notifying();

    const kept = await notifier.notify(asked(), 'task.asked');

    expect(kept.map((each) => `${each.kind}:${each.value}`)).toContain(
      'slack.thread:170.9',
    );
  });

  it('keeps nothing where the host refuses the post', async () => {
    const { notifier } = notifying({
      ok: false,
      status: 200,
      response: { ok: false },
      capture: {},
    });

    expect(await notifier.notify(asked(), 'task.asked')).toEqual([]);
  });

  it('posts nothing, and keeps nothing, for a host whose file reads a secret', async () => {
    const { notifier, run } = notifying(undefined, slack(READS_A_SECRET));

    expect(await notifier.notify(asked(), 'task.asked')).toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });

  it('runs the binding for the event it is given', async () => {
    const { notifier, run } = notifying();
    const opened = asked({ 'slack.thread': '170.1', 'slack.channel': 'C0REQ' });

    await notifier.notify(opened, 'task.opened');
    expect(run).toHaveBeenCalledTimes(1);

    run.mockClear();
    await notifier.notify(opened, 'task.moved');
    expect(run).not.toHaveBeenCalled();
  });
});
