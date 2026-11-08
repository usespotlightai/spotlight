import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { InboxWatch } from '@work/domain/aggregates/inbox-watch.aggregate';
import type { InboxItemArrived } from '@work/domain/events/inbox-item-arrived.event';
import type { InboxSighting } from '@work/domain/value-objects/inbox-sighting.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-08T10:00:00.000Z');
const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);

const SAM = UserId.of('user_1');
const ADA = UserId.of('user_2');

const sighting = (
  itemId: string,
  askedAt: Date,
  person = SAM,
  unread = true,
): InboxSighting => ({
  person,
  teamId: TeamId.of('team_1'),
  itemId,
  kind: 'task',
  title: `Item ${itemId}`,
  summary: null,
  unread,
  askedAt,
});

const read = (
  watch: InboxWatch,
  readAt: Date,
  sightings: InboxSighting[],
  people = [SAM, ADA],
  teams = ['team_1'],
) =>
  watch.sighted({
    people: people.map((person) => ({
      person,
      teams: teams.map((team) => TeamId.of(team)),
    })),
    sightings,
    readAt,
  });

const arrivedIn = (watch: InboxWatch) =>
  (watch.pullEvents() as InboxItemArrived[]).map(
    (each) => `${each.person.value} ${each.itemId}`,
  );

const watched = () => {
  const watch = read(InboxWatch.start(WorkspaceId.of('ws_1')), at(0), []);
  watch.pullEvents();

  return watch;
};

describe('InboxWatch', () => {
  it('takes a silent baseline of a person it sees for the first time, except items that just came in', () => {
    const first = read(InboxWatch.start(WorkspaceId.of('ws_1')), at(0), [
      sighting('old', at(-30)),
      sighting('new', at(-1)),
    ]);

    expect(arrivedIn(first)).toEqual(['user_1 new']);
  });

  it('announces any new item to a person it already watches, however old the item is', () => {
    const moved = read(watched(), at(1), [sighting('reassigned', at(-120))]);

    expect(arrivedIn(moved)).toEqual(['user_1 reassigned']);
  });

  it('announces an item once, however often it is read', () => {
    const once = read(watched(), at(1), [sighting('a', at(0))]);
    once.pullEvents();

    expect(arrivedIn(read(once, at(2), [sighting('a', at(0))]))).toEqual([]);
  });

  it('announces an item again when it asks again', () => {
    const once = read(watched(), at(1), [sighting('a', at(0))]);
    once.pullEvents();

    expect(arrivedIn(read(once, at(5), [sighting('a', at(4))]))).toEqual([
      'user_1 a',
    ]);
  });

  it('does not announce an item that is already read', () => {
    expect(
      arrivedIn(read(watched(), at(1), [sighting('a', at(0), SAM, false)])),
    ).toEqual([]);
  });

  it('ignores a read that is older than the one it already took', () => {
    const latest = read(watched(), at(5), [sighting('x', at(4))]);
    latest.pullEvents();

    const stale = read(latest, at(3), []);

    expect(stale.announced).toEqual(latest.announced);
    expect(arrivedIn(read(stale, at(6), [sighting('x', at(4))]))).toEqual([]);
  });

  it('announces one item to each person who sees it', () => {
    expect(
      arrivedIn(
        read(watched(), at(1), [
          sighting('a', at(0), SAM),
          sighting('a', at(0), ADA),
        ]),
      ),
    ).toEqual(['user_1 a', 'user_2 a']);
  });

  it('keeps the lease of a running recount when another recount is asked for', () => {
    const leased = watched().recountRequested(at(2)).leaseJob(at(2));
    const askedAgain = leased.recountRequested(at(4));

    expect(askedAgain.recount?.dueAt).toEqual(leased.recount?.dueAt);
    expect(() => askedAgain.leaseJob(at(5))).toThrow('no recount that is due');
  });

  it('leaves a due recount when one was asked for after the read began', () => {
    const leased = watched().recountRequested(at(2)).leaseJob(at(2));
    const askedAgain = leased.recountRequested(at(4));
    const after = read(askedAgain, at(3), []);

    expect(after.hasPendingJob).toBe(true);
    expect(after.recount?.dueAt).toBeNull();
    expect(read(leased, at(3), []).hasPendingJob).toBe(false);
  });

  it('takes a silent baseline of a team that a watched person joins', () => {
    const joined = read(
      watched(),
      at(1),
      [{ ...sighting('old', at(-60)), teamId: TeamId.of('team_2') }],
      [SAM, ADA],
      ['team_1', 'team_2'],
    );

    expect(arrivedIn(joined)).toEqual([]);
  });

  it('refuses a stored watch that announced one item twice to a person', () => {
    expect(() =>
      InboxWatch.rehydrate({
        workspaceId: WorkspaceId.of('ws_1'),
        watching: [],
        announced: [
          { person: 'user_1', itemId: 'a', askedAt: NOW },
          { person: 'user_1', itemId: 'a', askedAt: NOW },
        ],
        sightedAt: null,
        recount: null,
        version: 1,
      }),
    ).toThrow('announced the same item twice');
  });
});
