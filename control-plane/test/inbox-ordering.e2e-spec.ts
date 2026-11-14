import { randomUUID } from 'node:crypto';

import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { RunReadModel } from '@runs/application/services/run-read-model.service';
import { DrizzleRunFactsReader } from '@runs/infrastructure/persistence/drizzle/readers/run-facts.reader';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { InboxScope } from '@work/application/ports/inbox-reader.port';
import { Notice } from '@work/domain/aggregates/notice.aggregate';
import { NoticeExternalLink } from '@work/domain/value-objects/notice-external-link.vo';
import { NoticeId } from '@work/domain/value-objects/notice-id.vo';
import { NoticeLink } from '@work/domain/value-objects/notice-link.vo';
import { NoticeSubject } from '@work/domain/value-objects/notice-subject.vo';
import { NoticeWording } from '@work/domain/value-objects/notice-wording.vo';
import { DrizzleInboxReader } from '@work/infrastructure/persistence/drizzle/readers/inbox.reader';
import { DrizzleNoticeRepository } from '@work/infrastructure/persistence/drizzle/repositories/notice.repository';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { openDatabase, type TestDatabase } from './support/database';

let database: TestDatabase;
let notices: DrizzleNoticeRepository;
let reader: DrizzleInboxReader;

beforeAll(async () => {
  database = await openDatabase('inbox_ordering');
  const context = new DrizzleContext(database.db);

  notices = new DrizzleNoticeRepository(context, { dispatch: async () => {} });
  reader = new DrizzleInboxReader(
    database.db,
    { findMany: async () => new Map() } as never,
    new RunReadModel(new DrizzleRunFactsReader(context)),
  );
}, 60_000);

afterAll(async () => {
  await database?.close();
});

const WORKSPACE = randomUUID();
const at = (minute: number) => new Date(Date.UTC(2026, 9, 20, 9, minute, 0, 0));

const scopeOf = (viewer: string): InboxScope => ({
  workspaceId: WORKSPACE,
  viewer: UserId.of(viewer),
  teamsSeen: new Set(['team_1']),
  teamsActedOn: new Set(),
});

const noticeFor = (viewer: string, raisedAt: Date) =>
  Notice.create({
    id: NoticeId.of(randomUUID()),
    workspaceId: WorkspaceId.of(WORKSPACE),
    teamId: TeamId.of('team_1'),
    addressee: UserId.of(viewer),
    form: 'ended',
    subject: NoticeSubject.of(`subject ${randomUUID()}`),
    link: NoticeLink.of({ path: 'lines/line_1', label: 'Open the line' }),
    externalLink: NoticeExternalLink.of({
      url: 'https://github.com/acme/config/pull/12',
      label: 'Review the pull request',
    }),
    wording: NoticeWording.of({
      headline: 'The search stalled',
      points: ['Fix the rubric.'],
    }),
    at: raisedAt,
  });

const idsOf = (entries: readonly { readonly id: string }[]) =>
  entries.map((each) => each.id);

describe('the order of inbox notices', () => {
  it('lists open notices by arrival, newest first', async () => {
    const viewer = `user_${randomUUID()}`;
    const early = noticeFor(viewer, at(0));
    const late = noticeFor(viewer, at(5));

    await notices.add(early);
    await notices.add(late);

    expect(idsOf(await reader.open(scopeOf(viewer)))).toEqual([
      late.id.value,
      early.id.value,
    ]);
  });

  it('lists resolved notices by when the person resolved them, not by arrival', async () => {
    const viewer = `user_${randomUUID()}`;
    const early = noticeFor(viewer, at(0));
    const late = noticeFor(viewer, at(5));

    await notices.add(early);
    await notices.add(late);
    await notices.save(late.resolve(at(10)));
    await notices.save(early.resolve(at(20)));

    const page = await reader.resolved(scopeOf(viewer), {
      before: null,
      limit: 10,
    });

    expect(idsOf(page.items)).toEqual([early.id.value, late.id.value]);
  });

  it('pages resolved notices by resolve time without skipping or repeating one', async () => {
    const viewer = `user_${randomUUID()}`;
    const raised = [0, 1, 2, 3, 4].map((minute) =>
      noticeFor(viewer, at(minute)),
    );
    const resolveOrder = [3, 0, 4, 1, 2];

    for (const each of raised) {
      await notices.add(each);
    }

    for (const [turn, place] of resolveOrder.entries()) {
      const found = raised[place];

      await notices.save(found.resolve(at(30 + turn)));
    }

    const seen: string[] = [];
    let before: string | null = null;

    do {
      const page = await reader.resolved(scopeOf(viewer), { before, limit: 2 });

      seen.push(...idsOf(page.items));
      before = page.next;
    } while (before);

    expect(seen).toEqual(
      [...resolveOrder].reverse().map((place) => raised[place]?.id.value),
    );
  });

  it('puts a resolved then reopened notice among the open ones by arrival', async () => {
    const viewer = `user_${randomUUID()}`;
    const early = noticeFor(viewer, at(0));
    const late = noticeFor(viewer, at(5));

    await notices.add(early);
    await notices.add(late);
    await notices.save(early.resolve(at(10)));
    const resolved = (await notices.find(early.id)) as Notice;

    await notices.save(resolved.reopen(at(20)));

    expect(idsOf(await reader.open(scopeOf(viewer)))).toEqual([
      late.id.value,
      early.id.value,
    ]);
  });
});
