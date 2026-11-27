import { firstOf } from '@shared-kernel/domain/item-at';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { ResolveNoticeHandler } from '@work/application/commands/handlers/resolve-notice.handler';
import { ResolveNoticeCommand } from '@work/application/commands/resolve-notice.command';
import type { NoticeOf } from '@work/application/ports/notices.port';
import { NoticeLoader } from '@work/application/services/notice-loader.service';
import { Notices } from '@work/application/services/notices.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import type { Notice } from '@work/domain/aggregates/notice.aggregate';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';
import type { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { beforeEach, describe, expect, it } from 'vitest';

const NOW = new Date('2026-10-01T09:00:00.000Z');

class InMemoryNotices implements NoticeRepository {
  readonly stored = new Map<string, Notice>();

  add = async (notice: Notice) => {
    this.stored.set(notice.id.value, notice);
  };

  save = async (notice: Notice) => {
    this.stored.set(notice.id.value, notice);
  };

  find = async (id: { value: string }) => this.stored.get(id.value) ?? null;

  about = async (input: {
    readonly workspaceId: WorkspaceId | null;
    readonly teamId: TeamId | null;
    readonly addressee: UserId | null;
    readonly form: string;
    readonly subject: NoticeSubject;
  }) =>
    [...this.stored.values()].find(
      (each) =>
        (each.teamId === null || input.teamId === null
          ? each.teamId === input.teamId
          : each.teamId.equals(input.teamId)) &&
        (input.workspaceId === null ||
          each.workspaceId.equals(input.workspaceId)) &&
        (each.addressee === null || input.addressee === null
          ? each.addressee === input.addressee
          : each.addressee.equals(input.addressee)) &&
        each.form === input.form &&
        each.subject.equals(input.subject),
    ) ?? null;

  aboutWorkspace = async (workspaceId: WorkspaceId) =>
    [...this.stored.values()].filter(
      (each) => each.teamId === null && each.workspaceId.equals(workspaceId),
    );

  ofTeam = async (teamId: TeamId) =>
    [...this.stored.values()].filter(
      (each) => each.teamId?.equals(teamId) ?? false,
    );

  remove = async (notice: Notice) => {
    this.stored.delete(notice.id.value);
  };
}

let next = 0;

const members = new Set<string>();

const access = workAccessSeeing((teamId: TeamId, viewer: UserId) =>
  members.has(`${teamId.value}:${viewer.value}`),
);

const noticesOver = (memory: InMemoryNotices) =>
  new Notices(
    memory,
    access,
    { inTransaction: <T>(work: () => Promise<T>) => work() },
    { generate: () => `notice_${++next}` },
    { now: () => NOW, sleep: async () => {} },
  );

const STALLED: NoticeOf = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  addressee: UserId.of('user_1'),
  form: 'ended',
  subject: 'replay-search search_1 iteration 3',
  link: 'lines/line_1/stations/station_1',
  linkLabel: 'Open the station',
  externalLink: null,
  headline: 'The search stalled',
  points: ['Fix the claims.'],
};

describe('Notices', () => {
  it('allows an external link only to a GitHub address', () => {
    const notices = noticesOver(new InMemoryNotices());

    expect(
      notices.allowsExternalLink('https://github.com/acme/config/pull/7'),
    ).toBe(true);
    expect(
      notices.allowsExternalLink('https://git.example.test/acme/pull/7'),
    ).toBe(false);
  });

  beforeEach(() => {
    members.clear();
    members.add('team_1:user_1');
    members.add('team_2:user_1');
  });

  it('creates a notice once however often it is told of the same subject', async () => {
    const memory = new InMemoryNotices();
    const notices = noticesOver(memory);

    await notices.create(STALLED);
    await notices.create(STALLED);
    await notices.create({
      ...STALLED,
      subject: 'replay-search search_2 iteration 3',
    });

    expect(memory.stored.size).toBe(2);
  });

  it('resolves the team notice of a subject, and leaves the others open', async () => {
    const memory = new InMemoryNotices();
    const notices = noticesOver(memory);
    const team = { ...STALLED, addressee: null, form: 'advice' as const };

    await notices.create(team);
    await notices.create({ ...team, subject: 'memory-upkeep upkeep_2' });
    await notices.resolve({
      teamId: TeamId.of('team_1'),
      form: 'advice',
      subject: team.subject,
    });

    expect(
      [...memory.stored.values()].map((each) => each.resolvedAt !== null),
    ).toEqual([true, false]);
  });

  const OUTAGE = {
    workspaceId: WorkspaceId.of('ws_1'),
    form: 'advice' as const,
    subject: 'host-outage outage_1',
    link: 'settings/runners',
    linkLabel: 'Open runners',
    externalLink: null,
    headline: 'dev-host, the only host of the pool default, is offline',
    points: ['Start a host.'],
  };

  it('creates one notice about the whole workspace, with no team and no addressee, and resolves it', async () => {
    const memory = new InMemoryNotices();
    const notices = noticesOver(memory);
    const states = () =>
      [...memory.stored.values()].map((each) => [
        each.teamId,
        each.addressee,
        each.resolvedAt,
      ]);

    await notices.createAboutWorkspace(OUTAGE);
    await notices.createAboutWorkspace(OUTAGE);
    expect(states()).toEqual([[null, null, null]]);

    await notices.resolveInWorkspace({
      workspaceId: WorkspaceId.of('ws_2'),
      form: 'advice',
      subject: OUTAGE.subject,
    });
    expect(states()).toEqual([[null, null, null]]);

    await notices.resolveInWorkspace({
      workspaceId: WorkspaceId.of('ws_1'),
      form: 'advice',
      subject: OUTAGE.subject,
    });
    expect(states()).toEqual([[null, null, NOW]]);
  });

  it('deletes the notices about a deleted workspace, and keeps its team notices for their teams', async () => {
    const memory = new InMemoryNotices();
    const notices = noticesOver(memory);

    await notices.createAboutWorkspace(OUTAGE);
    await notices.create(STALLED);
    await notices.deleteForWorkspace(WorkspaceId.of('ws_1'));

    expect(
      [...memory.stored.values()].map((each) => each.teamId?.value),
    ).toEqual(['team_1']);
  });

  it('deletes the notices of a deleted team, and only those', async () => {
    const memory = new InMemoryNotices();
    const notices = noticesOver(memory);

    await notices.create(STALLED);
    await notices.create({
      ...STALLED,
      teamId: TeamId.of('team_2'),
      subject: 'replay-search search_9 iteration 3',
    });
    await notices.deleteForTeam(TeamId.of('team_1'));

    expect(
      [...memory.stored.values()].map((each) => each.teamId?.value),
    ).toEqual(['team_2']);
  });

  it('creates nothing for a team its person is no longer on, or that is gone', async () => {
    const memory = new InMemoryNotices();

    await noticesOver(memory).create({
      ...STALLED,
      teamId: TeamId.of('team_gone'),
    });

    expect(memory.stored.size).toBe(0);
  });

  it('creates no team notice for a team that is gone', async () => {
    const memory = new InMemoryNotices();
    const gone = partial<typeof access>({
      ...access,
      membersOf: async () => null,
    });

    await new Notices(
      memory,
      gone,
      { inTransaction: <T>(work: () => Promise<T>) => work() },
      { generate: () => `notice_${++next}` },
      { now: () => NOW, sleep: async () => {} },
    ).create({ ...STALLED, addressee: null });

    expect(memory.stored.size).toBe(0);
  });

  it('lets only its person, still on its team, in its workspace, resolve it', async () => {
    const memory = new InMemoryNotices();
    const clock = { now: () => NOW, sleep: async () => {} };
    const loader = new NoticeLoader(memory, access);
    const resolve = (id: string, slug: string, person: string) =>
      new ResolveNoticeHandler(loader, memory, clock).execute(
        new ResolveNoticeCommand(id, slug, person),
      );

    await noticesOver(memory).create(STALLED);

    const id = firstOf([...memory.stored.keys()]);

    if (id === undefined) {
      throw new Error('expected a stored notice');
    }

    members.add('team_1:user_2');
    await expect(resolve(id, 'acme', 'user_2')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await expect(resolve(id, 'elsewhere', 'user_1')).rejects.toMatchObject({
      kind: 'not-found',
    });
    await resolve(id, 'acme', 'user_1');
    expect(memory.stored.get(id)?.resolvedAt).toEqual(NOW);
    await expect(
      resolve('notice_missing', 'acme', 'user_1'),
    ).rejects.toMatchObject({ kind: 'not-found' });

    members.delete('team_1:user_1');
    await expect(resolve(id, 'acme', 'user_1')).rejects.toMatchObject({
      kind: 'not-found',
    });
    members.add('team_1:user_1');
  });

  it('addresses a team notice to every member of the team, once per subject, and lets any member resolve it for all', async () => {
    const memory = new InMemoryNotices();
    const clock = { now: () => NOW, sleep: async () => {} };
    const loader = new NoticeLoader(memory, access);
    const team = { ...STALLED, addressee: null };

    await noticesOver(memory).create(team);
    await noticesOver(memory).create(team);
    await noticesOver(memory).create(STALLED);

    expect(memory.stored.size).toBe(2);

    const shared = [...memory.stored.values()].find(
      (each) => each.addressee === null,
    );

    members.add('team_1:user_2');
    expect(shared?.isFor(UserId.of('user_2'))).toBe(true);
    await new ResolveNoticeHandler(loader, memory, clock).execute(
      new ResolveNoticeCommand(shared?.id.value ?? '', 'acme', 'user_2'),
    );
    expect(memory.stored.get(shared?.id.value ?? '')?.resolvedAt).toEqual(NOW);

    members.delete('team_1:user_2');
    await expect(
      new ResolveNoticeHandler(loader, memory, clock).execute(
        new ResolveNoticeCommand(shared?.id.value ?? '', 'acme', 'user_2'),
      ),
    ).rejects.toMatchObject({ kind: 'not-found' });
  });
});
