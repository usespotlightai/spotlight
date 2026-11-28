import {
  type InboxPart,
  type InboxPartKind,
  TaskInbox,
} from '@work/domain/services/task-inbox';
import { describe, expect, it } from 'vitest';

const at = (minute: number) =>
  new Date(`2026-11-27T09:${String(minute).padStart(2, '0')}:00.000Z`);

const part = (
  kind: InboxPartKind,
  minute: number,
  overrides: Partial<InboxPart> = {},
): InboxPart => ({
  kind,
  asks: 1,
  open: true,
  unread: true,
  unreadSince: at(minute),
  arrivedAt: at(minute),
  interactedAt: at(minute),
  resolvedAt: null,
  resolvable: true,
  reopenable: false,
  ...overrides,
});

const answered = (each: InboxPart, minute: number): InboxPart => ({
  ...each,
  open: false,
  unread: false,
  unreadSince: null,
  resolvedAt: at(minute),
  interactedAt: at(minute),
  resolvable: false,
  reopenable: true,
});

const disagreements = [
  part('judge-question', 1),
  part('judge-question', 2),
  part('judge-question', 3),
];

describe('TaskInbox.standingOf', () => {
  it('counts three judge questions and a station question on one task as four unread', () => {
    expect(
      TaskInbox.standingOf([...disagreements, part('question', 4)]),
    ).toMatchObject({ unreadCount: 4, resolved: false, listedAsOpen: true });
  });

  it('lowers the count as the questions are answered, and resolves once the last one is', () => {
    const [first, second, third] = disagreements;

    expect(
      TaskInbox.standingOf([answered(first, 5), second, third]),
    ).toMatchObject({ unreadCount: 2, resolved: false });
    expect(
      TaskInbox.standingOf([answered(first, 5), answered(second, 6), third]),
    ).toMatchObject({ unreadCount: 1, resolved: false });
    expect(
      TaskInbox.standingOf([
        answered(first, 5),
        answered(second, 6),
        answered(third, 7),
      ]),
    ).toMatchObject({
      unreadCount: 0,
      resolved: true,
      listedAsOpen: false,
      resolvedAt: at(7),
    });
  });

  it('opens again when something new arrives, and takes its time as the latest arrival', () => {
    const done = disagreements.map((each, place) => answered(each, 10 + place));

    expect(
      TaskInbox.standingOf([...done, part('judge-question', 20)]),
    ).toMatchObject({
      unreadCount: 1,
      resolved: false,
      listedAsOpen: true,
      arrivedAt: at(20),
    });
  });

  it('keeps a task listed while a closed conversation on it is still unread', () => {
    expect(
      TaskInbox.standingOf([part('question', 1, { open: false })]),
    ).toMatchObject({ resolved: true, listedAsOpen: true, unreadCount: 1 });
  });

  it('previews a station question before newer judge questions, since it blocks the line', () => {
    expect(
      TaskInbox.standingOf([part('question', 1), ...disagreements]),
    ).toMatchObject({ latest: { kind: 'question', count: 1 }, quiet: false });
  });

  it('counts the disputed claims a judge disagreement still asks, not the disagreement', () => {
    const twoClaims = part('judge-question', 1, { asks: 2 });
    const oneClaim = part('judge-question', 2);
    const memories = part('memories', 3);

    expect(TaskInbox.standingOf([twoClaims, oneClaim, memories])).toMatchObject(
      {
        unreadCount: 4,
        latest: { kind: 'memories', count: 1 },
      },
    );
    expect(TaskInbox.standingOf([twoClaims, oneClaim])).toMatchObject({
      unreadCount: 3,
      latest: { kind: 'judge-question', count: 3 },
    });
  });

  it('previews how many judge questions are unread, and is quiet while only they are', () => {
    expect(TaskInbox.standingOf(disagreements)).toMatchObject({
      latest: { kind: 'judge-question', count: 3 },
      quiet: true,
    });
  });

  it('is not quiet once nothing is unread', () => {
    expect(
      TaskInbox.standingOf(disagreements.map((each) => answered(each, 9))),
    ).toMatchObject({ latest: null, quiet: false });
  });

  it('can be resolved while anything open in it can be', () => {
    expect(
      TaskInbox.standingOf([
        part('question', 1, { resolvable: false }),
        part('judge-question', 2),
      ])?.resolvable,
    ).toBe(true);
  });

  it('has no standing without parts', () => {
    expect(TaskInbox.standingOf([])).toBeNull();
  });
});

describe('TaskInbox.anchorOf', () => {
  it('opens on the open conversation', () => {
    const open = part('question', 1);

    expect(
      TaskInbox.anchorOf([
        part('question', 0, { open: false }),
        open,
        part('judge-question', 3),
      ]),
    ).toBe(open);
  });

  it('opens on the newest conversation when none is open', () => {
    const newest = part('failure', 2, { open: false });

    expect(
      TaskInbox.anchorOf([
        part('question', 1, { open: false }),
        newest,
        part('judge-question', 3),
      ]),
    ).toBe(newest);
  });

  it('opens on the newest request on a task with no conversation', () => {
    expect(TaskInbox.anchorOf(disagreements)).toBe(disagreements[2]);
  });
});

describe('TaskInbox.firstUnread', () => {
  it('finds the part with the oldest note not seen yet', () => {
    expect(
      TaskInbox.firstUnread([
        part('judge-question', 3),
        part('question', 2, { unread: false, unreadSince: null }),
        part('judge-question', 1),
      ]),
    ).toMatchObject({ arrivedAt: at(1) });
  });

  it('opens on a conversation whose first unread ask came before a judge question, though it asked again since', () => {
    const conversation = part('question', 9, { unreadSince: at(1) });

    expect(
      TaskInbox.firstUnread([part('judge-question', 5), conversation]),
    ).toBe(conversation);
  });
});

describe('TaskInbox.toResolve', () => {
  it('resolves everything open that the person may resolve', () => {
    const blocked = part('question', 1, { resolvable: false });
    const done = answered(part('judge-question', 2), 3);
    const waiting = part('judge-question', 4);

    expect(TaskInbox.toResolve([blocked, done, waiting])).toEqual([waiting]);
  });
});

describe('TaskInbox.toReopen', () => {
  it('reopens what a person resolved, not what was answered where it was asked', () => {
    const settled = {
      ...answered(part('judge-question', 1), 2),
      reopenable: false,
    };
    const resolvedOne = answered(part('judge-question', 3), 9);
    const resolvedTwo = answered(part('memories', 4), 9);

    expect(TaskInbox.toReopen([settled, resolvedOne, resolvedTwo])).toEqual([
      resolvedOne,
      resolvedTwo,
    ]);
  });

  it('reopens nothing while something is still open', () => {
    expect(
      TaskInbox.toReopen([
        answered(part('judge-question', 1), 2),
        part('question', 3),
      ]),
    ).toEqual([]);
  });

  it('reopens nothing that cannot be reopened', () => {
    expect(
      TaskInbox.toReopen([
        { ...answered(part('question', 1), 2), reopenable: false },
      ]),
    ).toEqual([]);
  });
});

describe('TaskInbox kinds', () => {
  it('names each inbox request by what it asks', () => {
    expect(TaskInbox.kindOfRequest('judge-disagreement')).toBe(
      'judge-question',
    );
    expect(TaskInbox.kindOfRequest('memories')).toBe('memories');
    expect(TaskInbox.kindOfRequest('alert')).toBe('alert');
  });

  it('says only a station question and a failed run block the line', () => {
    expect(TaskInbox.blocksTheLine('question')).toBe(true);
    expect(TaskInbox.blocksTheLine('failure')).toBe(true);
    expect(TaskInbox.blocksTheLine('judge-question')).toBe(false);
    expect(TaskInbox.blocksTheLine('memories')).toBe(false);
  });

  it('holds an open conversation while the task is on the line, and a closed one for its assignee', () => {
    expect(
      TaskInbox.holdsConversation({ open: true }, { finished: false }, 'team'),
    ).toBe(true);
    expect(
      TaskInbox.holdsConversation({ open: true }, { finished: true }, 'team'),
    ).toBe(false);
    expect(
      TaskInbox.holdsConversation(
        { open: false },
        { finished: true },
        'assignee',
      ),
    ).toBe(true);
    expect(
      TaskInbox.holdsConversation({ open: false }, { finished: false }, 'team'),
    ).toBe(false);
  });
});
