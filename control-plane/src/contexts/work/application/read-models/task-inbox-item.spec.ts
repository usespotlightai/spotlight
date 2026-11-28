import type {
  InboxPartSummary,
  InboxRunSummary,
} from '@work/application/ports/inbox-reader.port';
import {
  groupOf,
  type PartItem,
  type Piece,
} from '@work/application/read-models/task-inbox-item';
import type { InboxPartKind } from '@work/domain/services/task-inbox';
import { describe, expect, it } from 'vitest';

const at = (minute: number) =>
  new Date(`2026-11-27T09:${String(minute).padStart(2, '0')}:00.000Z`);

const itemOf = (id: string, overrides: Partial<PartItem> = {}): PartItem => ({
  kind: 'task',
  id,
  taskId: 'task_1',
  teamId: 'team_1',
  title: 'Fix the queue',
  description: null,
  attachments: [],
  station: 'Triage',
  stationColor: '#edc12b',
  stationPosition: 1,
  stationCount: 3,
  originStation: { name: 'Triage', color: '#edc12b', position: 1 },
  currentStation: {
    name: 'Triage',
    color: '#edc12b',
    position: 1,
    latestRunId: null,
  },
  createdAt: at(0),
  askedAt: at(0),
  resolved: false,
  section: 'open',
  standing: 'assignee',
  answerable: false,
  resolvable: true,
  reopenable: false,
  progress: null,
  runId: null,
  stoppableByYou: false,
  unread: true,
  briefing: null,
  failure: null,
  lastNote: null,
  ...overrides,
});

const piece = (
  id: string,
  kind: InboxPartKind,
  minute: number,
  overrides: Partial<InboxPartSummary> = {},
  item: Partial<PartItem> = {},
): Piece => {
  const part: InboxPartSummary = {
    id,
    kind,
    form: kind === 'judge-question' ? 'judge-disagreement' : null,
    about: kind === 'judge-question' ? `disagreement_${id}` : null,
    asks: 1,
    open: true,
    waits: overrides.open ?? true,
    unread: true,
    unreadSince: at(minute),
    arrivedAt: at(minute),
    interactedAt: at(minute),
    resolvedAt: null,
    resolvable: true,
    reopenable: false,
    ...overrides,
  };

  return {
    item: itemOf(id, {
      askedAt: part.interactedAt,
      resolved: !part.open,
      unread: part.unread,
      answerable: kind === 'question' && part.open,
      ...item,
    }),
    part,
    firstUnreadAt: kind === 'question' && part.unread ? 4 : null,
    resolutionKey: part.resolvedAt?.toISOString() ?? null,
  };
};

const question = piece('task_1:2', 'question', 4);
const judged = [
  piece('request_1', 'judge-question', 1),
  piece('request_2', 'judge-question', 2),
  piece('request_3', 'judge-question', 3),
];

const answered = (each: Piece, minute: number): Piece =>
  piece(each.part.id, each.part.kind, each.part.arrivedAt.getUTCMinutes(), {
    open: false,
    unread: false,
    unreadSince: null,
    resolvedAt: at(minute),
    interactedAt: at(minute),
    resolvable: false,
    reopenable: true,
  });

describe('groupOf', () => {
  it('makes one item of three judge questions and a question on one task, counting four', () => {
    expect(
      groupOf({ pieces: [...judged, question], run: null, newestAt: null })
        ?.item,
    ).toMatchObject({
      id: 'task_1',
      taskId: 'task_1',
      unreadCount: 4,
      unread: true,
      resolved: false,
      section: 'open',
      conversationId: 'task_1:2',
      answerable: true,
      latest: { kind: 'question', count: 1 },
      quiet: false,
    });
  });

  it('lists every part, oldest first', () => {
    expect(
      groupOf({
        pieces: [question, ...judged],
        run: null,
        newestAt: null,
      })?.item.parts.map((each) => each.id),
    ).toEqual(['request_1', 'request_2', 'request_3', 'task_1:2']);
  });

  it('opens at the oldest part not seen yet', () => {
    expect(
      groupOf({
        pieces: [question, ...judged.slice(1)],
        run: null,
        newestAt: null,
      })?.item.firstUnread,
    ).toEqual({ partId: 'request_2', position: null });
    expect(
      groupOf({ pieces: [question], run: null, newestAt: null })?.item
        .firstUnread,
    ).toEqual({ partId: 'task_1:2', position: 4 });
  });

  it('lowers the count as judge questions are answered, and resolves once the last one is', () => {
    const [one, two, three] = judged;
    const step = (pieces: Piece[]) =>
      groupOf({ pieces, run: null, newestAt: null });

    expect(step([answered(one, 5), two, three])?.item.unreadCount).toBe(2);
    expect(
      step([answered(one, 5), answered(two, 6), three])?.item.unreadCount,
    ).toBe(1);

    const done = step([answered(one, 5), answered(two, 6), answered(three, 7)]);

    expect(done).toMatchObject({
      listedAsOpen: false,
      resolutionKey: at(7).toISOString(),
      item: {
        unreadCount: 0,
        resolved: true,
        section: 'resolved',
        conversationId: null,
        reopenable: true,
        resolvable: false,
      },
    });
  });

  it('opens again on something new and takes its arrival as the time to sort by', () => {
    const done = judged.map((each, place) => answered(each, 10 + place));
    const reopened = groupOf({
      pieces: [...done, piece('request_4', 'judge-question', 30)],
      run: null,
      newestAt: null,
    });

    expect(reopened).toMatchObject({
      listedAsOpen: true,
      arrivedAt: at(30),
      item: { unreadCount: 1, resolved: false, askedAt: at(30) },
    });
  });

  it('is quiet while only judge questions are unread', () => {
    expect(
      groupOf({ pieces: judged, run: null, newestAt: null })?.item,
    ).toMatchObject({
      quiet: true,
      latest: { kind: 'judge-question', count: 3 },
    });
  });

  it('shows the run that works the task when nothing in it says so', () => {
    const run: InboxRunSummary = {
      kind: 'run',
      id: 'run_1',
      taskId: 'task_1',
      teamId: 'team_1',
      title: 'Fix the queue',
      station: 'Triage',
      stationColor: '#edc12b',
      stationPosition: 1,
      stationCount: 3,
      progress: 'in-progress',
      askedAt: at(0),
      unread: false,
      unreadCount: 0,
      resolved: false,
      section: 'running',
      standing: 'assignee',
      reopenable: false,
      stoppableByYou: true,
    };

    expect(
      groupOf({
        pieces: judged.map((each) => answered(each, 9)),
        run,
        newestAt: null,
      })?.item,
    ).toMatchObject({
      progress: 'in-progress',
      runId: 'run_1',
      stoppableByYou: true,
      section: 'resolved',
    });
  });

  it('previews the memories that wait on a read row, not the conversation its run works on', () => {
    const working = piece(
      'task_1:2',
      'question',
      1,
      { unread: false, unreadSince: null, waits: false },
      { progress: 'in-progress', runId: 'run_1' },
    );
    const memories = piece('request_5', 'memories', 5, {
      unread: false,
      unreadSince: null,
    });

    expect(
      groupOf({ pieces: [working, memories], run: null, newestAt: null })?.item,
    ).toMatchObject({
      unread: false,
      unreadCount: 0,
      conversationId: 'task_1:2',
      latest: { kind: 'memories', count: 1 },
      section: 'running',
    });
  });

  it('has nothing to show without parts', () => {
    expect(groupOf({ pieces: [], run: null, newestAt: null })).toBeNull();
  });

  it('opens on the conversation a link names, though another one is newer', () => {
    const older = piece('task_1:0', 'question', 1, {
      open: false,
      unread: false,
      unreadSince: null,
      resolvedAt: at(2),
    });

    expect(
      groupOf(
        { pieces: [older, question], run: null, newestAt: null },
        'task_1:0',
      )?.item.conversationId,
    ).toBe('task_1:0');
  });

  it('files a task the viewer follows under Following only while nothing on it is new for them', () => {
    const followed = { standing: 'following' as const };
    const alert = piece('request_9', 'alert', 5);
    const conversation = piece(
      'task_1:2',
      'question',
      4,
      { unread: false, unreadSince: null },
      followed,
    );

    expect(
      groupOf({ pieces: [conversation, alert], run: null, newestAt: null })
        ?.item.section,
    ).toBe('open');
    expect(
      groupOf({ pieces: [conversation], run: null, newestAt: null })?.item
        .section,
    ).toBe('following');
  });

  it('does not open on an older conversation that it does not show', () => {
    const older = piece('task_1:0', 'question', 1, {
      open: false,
      unreadSince: at(1),
    });

    expect(
      groupOf({
        pieces: [older, question, ...judged.slice(2)],
        run: null,
        newestAt: null,
      })?.item.firstUnread,
    ).toEqual({ partId: 'request_3', position: null });
  });

  it('says which parts resolving and reopening the item act on', () => {
    const blocked = piece('task_1:2', 'question', 4, { resolvable: false });
    const [one, two] = judged;

    expect(
      groupOf({
        pieces: [blocked, one, two],
        run: null,
        newestAt: null,
      })?.item.parts.map((each) => [each.id, each.resolvable]),
    ).toEqual([
      ['request_1', true],
      ['request_2', true],
      ['task_1:2', false],
    ]);
    const settled = answered(one, 5);

    expect(
      groupOf({
        pieces: [
          { ...settled, part: { ...settled.part, reopenable: false } },
          answered(two, 40),
        ],
        run: null,
        newestAt: null,
      })?.item.parts.map((each) => [each.id, each.reopenable]),
    ).toEqual([
      ['request_1', false],
      ['request_2', true],
    ]);
  });
});
