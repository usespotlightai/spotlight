import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { WorkspaceReaderPort } from '@application/ports/workspace-reader.port';
import type { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import type { Factory } from '@domain/aggregates/factory.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';
import { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { TeamId } from '@domain/value-objects/team-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { IntegrationReader } from '@infrastructure/integrations/integration.reader';
import type { OAuth2Access } from '@infrastructure/integrations/oauth2-access';
import type {
  HttpOutbound,
  OutboundResult,
} from '@infrastructure/outbound/http-outbound';
import { OutboundAskNotifier } from '@infrastructure/outbound/outbound-ask.notifier';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');
const STATION = StationId.of('station_1');

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
on:
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

const asked = (marks: Mark[] = []) => {
  let task = Task.add({
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: STATION,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => 'task_1',
  });

  for (const mark of marks) {
    task = task.markedBy(mark);
  }

  return task.askedAbout({
    station: StationName.of('Triage'),
    body: TaskNoteBody.of('Which queue should I drain?'),
    at: NOW,
    voice: Voice.station(),
  });
};

const line = {
  factoryId: FactoryId.of('factory_1'),
  key: { value: 'delivery' },
  stationAt: () => ({ name: { value: 'Triage' } }),
} as unknown as AssemblyLine;

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

  const notifier = new OutboundAskNotifier(
    { holding: vi.fn(async () => line) } as unknown as AssemblyLineRepository,
    {
      find: vi.fn(
        async () => ({ teamId: TeamId.of('team_1') }) as unknown as Factory,
      ),
    } as unknown as FactoryRepository,
    {
      findFor: vi.fn(async () => ({
        under: () => [
          ConfigurationFile.of('.spotlight/integrations/slack.yml', SLACK),
        ],
      })),
    } as unknown as TeamConfigurationRepository,
    new IntegrationReader(),
    {
      resolve: vi.fn(async (_team: unknown, name: { value: string }) =>
        name.value === 'SLACK_BOT_TOKEN' ? 'xoxb-1' : null,
      ),
    } as unknown as TeamSecretsPort,
    { run } as unknown as HttpOutbound,
    { token: async () => null } as unknown as OAuth2Access,
    { slugOf: vi.fn(async () => 'acme') } as unknown as WorkspaceReaderPort,
    'https://app.example',
    { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() },
  );

  return { notifier, run };
};

describe('OutboundAskNotifier', () => {
  it('posts a routed line’s ask to its channel, with the ask body and a link', async () => {
    const { notifier, run } = notifying();

    await notifier.onAsked(asked());

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

    await notifier.onAsked(
      asked([
        Mark.of('slack.thread', '170.1'),
        Mark.of('slack.channel', 'C0REQ'),
      ]),
    );

    const action = run.mock.calls[0]?.[1] as {
      target: { channel?: string; thread?: string };
    };
    expect(action.target.channel).toBe('C0REQ');
    expect(action.target.thread).toBe('170.1');
  });

  it('hands back the thread it captured, for the caller to record', async () => {
    const { notifier } = notifying();

    const kept = await notifier.onAsked(asked());

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

    expect(await notifier.onAsked(asked())).toEqual([]);
  });
});
