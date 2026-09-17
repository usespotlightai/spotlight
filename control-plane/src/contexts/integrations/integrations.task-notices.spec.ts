import type { AppliedConfigurationPort } from '@configuration/application/ports/applied-configuration.port';
import type { TeamSecretsPort } from '@configuration/application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import { HostReach } from '@integrations/application/services/host-reach.service';
import { TaskNotices } from '@integrations/application/services/task-notices.service';
import type { HostConnectionRepository } from '@integrations/domain/repositories/host-connection.repository';
import { CompiledIntegrationRuntime } from '@integrations/infrastructure/integrations/compiled-integration.runtime';
import { IntegrationReader } from '@integrations/infrastructure/integrations/integration.reader';
import { OAuth2Clients } from '@integrations/infrastructure/integrations/oauth2-clients';
import type { OAuth2Exchange } from '@integrations/infrastructure/integrations/oauth2-exchange';
import type {
  HttpOutbound,
  OutboundResult,
} from '@integrations/infrastructure/outbound/http-outbound';
import { WebInboxLinks } from '@integrations/presentation/http/web-inbox-links';
import { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { BoundTaskDto } from '@work/application/dto/bound-task.dto';
import { describe, expect, it, vi } from 'vitest';

const runtimeWith = (
  outbound: unknown,
  exchange: unknown = {},
  clients: OAuth2Clients = OAuth2Clients.from('{}'),
) =>
  new CompiledIntegrationRuntime(
    new IntegrationReader(),
    outbound as HttpOutbound,
    clients,
    exchange as OAuth2Exchange,
  );

const _NOW = new Date('2026-09-07T10:00:00.000Z');

const SLACK = `
version: 1
integration: slack
webhook:
  verify:
    hmac:
      algorithm: sha256
      secret: secret.SLACK_SIGNING_SECRET
      header: x-slack-signature
  events:
    - when: '\${{ body.event.type == "app_mention" }}'
      raise:
        happening: slack.app_mention
        label: Mentioned
        told: Mentioned.
        marks:
          - kind: slack.thread
            value: '\${{ body.event.ts }}'
actions:
  post-message:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        authorization: '\${{ "Bearer " + secret.SLACK_BOT_TOKEN }}'
      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": ask.body} }}'
      expect:
        success: '\${{ response.ok }}'
      capture:
        thread: '\${{ response.ts }}'
  acknowledge:
    request:
      method: POST
      url: https://slack.com/api/chat.postMessage
      headers:
        authorization: '\${{ "Bearer " + secret.SLACK_BOT_TOKEN }}'
      body: '\${{ {"channel": target.channel, "thread_ts": target.thread, "text": dyn("On it.")} }}'
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

const asked = (marks: Record<string, string> = {}): BoundTaskDto => ({
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
  },
});

const notifying = (
  reply: OutboundResult = {
    ok: true,
    status: 200,
    response: { ok: true, ts: '170.9' },
    capture: { thread: '170.9' },
  },
) => {
  const run = vi.fn(
    async (_action: unknown, _against: Record<string, unknown>) => reply,
  );

  const notifier = new TaskNotices(
    {
      of: vi.fn(async () => ({
        files: [
          ConfigurationFile.of('.spotlight/integrations/slack.yml', SLACK),
        ],
      })),
    } as unknown as AppliedConfigurationPort,
    runtimeWith({ run } as unknown as HttpOutbound),
    new HostReach(
      {
        resolveAll: vi.fn(
          async (_team: unknown, names: readonly { value: string }[]) =>
            Object.fromEntries(
              names
                .filter((name) => name.value === 'SLACK_BOT_TOKEN')
                .map((name) => [name.value, 'xoxb-1']),
            ),
        ),
      } as unknown as TeamSecretsPort,
      { of: async () => null } as unknown as HostConnectionRepository,
    ),
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
