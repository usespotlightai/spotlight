import type { WorkspaceAccessPort } from '@identity/application/ports/workspace-access.port';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ReadNoticeHandler } from '@work/application/commands/handlers/read-notice.handler';
import { SettleNoticeHandler } from '@work/application/commands/handlers/settle-notice.handler';
import { ReadNoticeCommand } from '@work/application/commands/read-notice.command';
import { SettleNoticeCommand } from '@work/application/commands/settle-notice.command';
import type { NoticeOf } from '@work/application/ports/notices.port';
import { NoticeAtHand } from '@work/application/services/notice-at-hand.service';
import { Notices } from '@work/application/services/notices.service';
import type { Notice } from '@work/domain/aggregates/notice.aggregate';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

class InMemoryNotices implements NoticeRepository {
  readonly held = new Map<string, Notice>();

  add = async (notice: Notice) => {
    this.held.set(notice.id.value, notice);
  };

  save = async (notice: Notice) => {
    this.held.set(notice.id.value, notice);
  };

  find = async (id: { value: string }) => this.held.get(id.value) ?? null;

  about = async (addressee: UserId, form: string, subject: string) =>
    [...this.held.values()].find(
      (each) =>
        each.isFor(addressee) && each.form === form && each.subject === subject,
    ) ?? null;

  forgetTeam = async (teamId: TeamId) => {
    for (const [id, each] of this.held) {
      if (each.teamId.equals(teamId)) {
        this.held.delete(id);
      }
    }
  };
}

let next = 0;

const members = new Set<string>();

const access = {
  onTeam: async (teamId: string, viewer: UserId) =>
    members.has(`${teamId}:${viewer.value}`)
      ? {
          workspaceId: WorkspaceId.of('ws_1'),
          slug: 'acme',
          viewer,
          administers: false,
          teamId: TeamId.of(teamId),
        }
      : null,
} as unknown as WorkspaceAccessPort;

const noticesOver = (memory: InMemoryNotices) =>
  new Notices(
    memory,
    access,
    { run: <T>(work: () => Promise<T>) => work() },
    { generate: () => `notice_${++next}` },
    { now: () => NOW, sleep: async () => {} },
  );

const STALLED: NoticeOf = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  addressee: UserId.of('user_1'),
  form: 'ended',
  subject: 'replay-search search_1 iteration 3',
  link: 'lines/line_1/stations/station_1/searches/search_1',
  linkLabel: 'Open the search',
  headline: 'The search stalled',
  points: ['Fix the rubric.'],
};

describe('Notices', () => {
  beforeEach(() => {
    members.clear();
    members.add('team_1:user_1');
    members.add('team_2:user_1');
  });

  it('raises a notice once however often it is told of the same subject', async () => {
    const memory = new InMemoryNotices();
    const notices = noticesOver(memory);

    await notices.raise(STALLED);
    await notices.raise(STALLED);
    await notices.raise({
      ...STALLED,
      subject: 'replay-search search_2 iteration 3',
    });

    expect(memory.held.size).toBe(2);
  });

  it('refuses a form it does not know', async () => {
    await expect(
      noticesOver(new InMemoryNotices()).raise({ ...STALLED, form: 'gossip' }),
    ).rejects.toThrow('A notice is one of');
  });

  it('forgets the notices of a disbanded team, and only those', async () => {
    const memory = new InMemoryNotices();
    const notices = noticesOver(memory);

    await notices.raise(STALLED);
    await notices.raise({
      ...STALLED,
      teamId: TeamId.of('team_2'),
      subject: 'replay-search search_9 iteration 3',
    });
    await notices.forgetTeam(TeamId.of('team_1'));

    expect([...memory.held.values()].map((each) => each.teamId.value)).toEqual([
      'team_2',
    ]);
  });

  it('raises nothing for a team its person is no longer on, or that is gone', async () => {
    const memory = new InMemoryNotices();

    await noticesOver(memory).raise({
      ...STALLED,
      teamId: TeamId.of('team_gone'),
    });

    expect(memory.held.size).toBe(0);
  });

  it('lets only its person, still on its team, in its workspace, read or settle it', async () => {
    const memory = new InMemoryNotices();
    const clock = { now: () => NOW, sleep: async () => {} };
    const atHand = new NoticeAtHand(memory, access);
    const read = (id: string, slug: string, person: string) =>
      new ReadNoticeHandler(atHand, memory, clock).execute(
        new ReadNoticeCommand(id, slug, person),
      );
    const settle = (id: string, slug: string, person: string) =>
      new SettleNoticeHandler(atHand, memory, clock).execute(
        new SettleNoticeCommand(id, slug, person),
      );

    await noticesOver(memory).raise(STALLED);

    const [id] = [...memory.held.keys()] as [string];

    members.add('team_1:user_2');
    await expect(read(id, 'acme', 'user_2')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(read(id, 'elsewhere', 'user_1')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await read(id, 'acme', 'user_1');
    expect(memory.held.get(id)?.readAt).toEqual(NOW);
    await settle(id, 'acme', 'user_1');
    expect(memory.held.get(id)?.settledAt).toEqual(NOW);
    await expect(
      settle('notice_missing', 'acme', 'user_1'),
    ).rejects.toMatchObject({ kind: 'not-found' });

    members.delete('team_1:user_1');
    await expect(read(id, 'acme', 'user_1')).rejects.toMatchObject({
      kind: 'not-found',
    });
    members.add('team_1:user_1');
  });
});
