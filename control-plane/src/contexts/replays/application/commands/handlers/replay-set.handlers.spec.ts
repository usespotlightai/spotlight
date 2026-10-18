import { AddReplaySetEntryCommand } from '@replays/application/commands/add-replay-set-entry.command';
import { CreateReplaySetCommand } from '@replays/application/commands/create-replay-set.command';
import { DeleteReplaySetCommand } from '@replays/application/commands/delete-replay-set.command';
import { AddReplaySetEntryHandler } from '@replays/application/commands/handlers/add-replay-set-entry.handler';
import { CreateReplaySetHandler } from '@replays/application/commands/handlers/create-replay-set.handler';
import { DeleteReplaySetHandler } from '@replays/application/commands/handlers/delete-replay-set.handler';
import { RemoveReplaySetEntryHandler } from '@replays/application/commands/handlers/remove-replay-set-entry.handler';
import { RemoveReplaySetEntryCommand } from '@replays/application/commands/remove-replay-set-entry.command';
import {
  accessFor,
  CLOCK,
  FakeWork,
  IDS,
  InMemoryReplays,
  PERSON,
  stationsFor,
  TRANSACTION,
} from '@replays/application/services/replays.fake-spec';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import {
  aReplay,
  aSearch,
  aSet,
  BY,
  NOW,
  SEARCH_ID,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;

const errorOf = async (call: Promise<unknown>) =>
  call.then(
    () => {
      throw new Error('it was allowed');
    },
    (error: unknown) => {
      if (error instanceof ApplicationError) {
        return error.kind;
      }
      throw error;
    },
  );

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
});

describe('CreateReplaySetHandler', () => {
  const creating = (mayPlan: boolean | null) =>
    new CreateReplaySetHandler(
      accessFor(memory, work, mayPlan),
      memory.setRepository,
      IDS,
      CLOCK,
    );

  it('creates an empty set at a station of the team', async () => {
    const created = await creating(true).execute(
      new CreateReplaySetCommand(
        'team_1',
        'line_1',
        'station_build',
        'Queue fixes',
        PERSON,
      ),
    );

    expect(created.outcome).toBe('created');
    expect([...memory.sets.values()][0]?.name.value).toBe('Queue fixes');
  });

  it('denies one who may read the team but not plan', async () => {
    expect(
      await creating(false).execute(
        new CreateReplaySetCommand(
          'team_1',
          'line_1',
          'station_build',
          'Queue fixes',
          PERSON,
        ),
      ),
    ).toEqual({ outcome: 'forbidden', act: 'plan' });
  });

  it('knows no team the caller may not read, nor a station elsewhere', async () => {
    expect(
      await errorOf(
        creating(null).execute(
          new CreateReplaySetCommand(
            'team_1',
            'line_1',
            'station_build',
            'x',
            PERSON,
          ),
        ),
      ),
    ).toBe('not-found');
    expect(
      await errorOf(
        creating(true).execute(
          new CreateReplaySetCommand(
            'team_1',
            'line_2',
            'station_build',
            'x',
            PERSON,
          ),
        ),
      ),
    ).toBe('not-found');
  });
});

describe('AddReplaySetEntryHandler', () => {
  const adding = () =>
    new AddReplaySetEntryHandler(
      accessFor(memory, work),
      memory.setRepository,
      memory.searchRepository,
      work,
      CLOCK,
      stationsFor(memory, work),
      TRANSACTION,
    );

  beforeEach(async () => {
    await memory.setRepository.add(aSet());
  });

  it('notes a set whose station Work no longer has, and adds nothing to it', async () => {
    work.station = async () => null;

    expect(
      await errorOf(
        adding().execute(
          new AddReplaySetEntryCommand('team_1', 'set_1', 'run_1', PERSON),
        ),
      ),
    ).toBe('conflict');
    expect(memory.sets.get('set_1')?.isAtGoneStation).toBe(true);
  });

  it('adds a run Work says can be replayed, saying the set’s runs changed', async () => {
    work.replayables.set('run_1', {
      runId: RunId.of('run_1'),
      taskId: TaskId.of('task_1'),
      stationId: STATION.stationId,
      unreplayableReason: null,
      reason: null,
    });

    await adding().execute(
      new AddReplaySetEntryCommand('team_1', 'set_1', 'run_1', PERSON),
    );

    expect(memory.sets.get('set_1')?.runs.map((each) => each.value)).toEqual([
      'run_1',
    ]);
    expect(memory.events).toEqual([
      new ReplaySetEntriesChanged(
        memory.sets.get('set_1')?.id as never,
        STATION.workspaceId,
      ),
    ]);
  });

  it('rejects a run Work cannot replay, or knows nothing of', async () => {
    work.replayables.set('run_1', {
      runId: RunId.of('run_1'),
      taskId: TaskId.of('task_1'),
      stationId: STATION.stationId,
      unreplayableReason: 'archive-gone',
      reason: 'the archive is gone',
    });

    expect(
      await errorOf(
        adding().execute(
          new AddReplaySetEntryCommand('team_1', 'set_1', 'run_1', PERSON),
        ),
      ),
    ).toBe('conflict');
    expect(
      await errorOf(
        adding().execute(
          new AddReplaySetEntryCommand('team_1', 'set_1', 'run_9', PERSON),
        ),
      ),
    ).toBe('conflict');
  });
});

describe('RemoveReplaySetEntryHandler', () => {
  it('takes a run out of a set', async () => {
    await memory.setRepository.add(aSet(2));

    await new RemoveReplaySetEntryHandler(
      accessFor(memory, work),
      memory.setRepository,
      memory.searchRepository,
      TRANSACTION,
    ).execute(
      new RemoveReplaySetEntryCommand('team_1', 'set_1', 'original_0', PERSON),
    );

    expect(memory.sets.get('set_1')?.runs.map((each) => each.value)).toEqual([
      'original_1',
    ]);
  });
});

describe('DeleteReplaySetHandler', () => {
  const deleting = () =>
    new DeleteReplaySetHandler(
      accessFor(memory, work),
      memory.setRepository,
      memory.replayRepository,
      memory.searchRepository,
      TRANSACTION,
    );

  it('rejects while a replay of the set is in progress', async () => {
    await memory.setRepository.add(aSet(1));
    await memory.replayRepository.add(aReplay({ count: 1 }));

    expect(
      await errorOf(
        deleting().execute(
          new DeleteReplaySetCommand('team_1', 'set_1', PERSON),
        ),
      ),
    ).toBe('conflict');
  });

  it('deletes a set nothing of is in progress', async () => {
    await memory.setRepository.add(aSet(1));

    await deleting().execute(
      new DeleteReplaySetCommand('team_1', 'set_1', PERSON),
    );

    expect(memory.sets.size).toBe(0);
  });
});

describe('a set under search', () => {
  beforeEach(async () => {
    const set = aSet(10);

    await memory.setRepository.add(set);
    await memory.searchRepository.add(aSearch({ set }));
  });

  it('takes no run, lets none go and is not deleted while the search is active', async () => {
    expect(
      await errorOf(
        new AddReplaySetEntryHandler(
          accessFor(memory, work),
          memory.setRepository,
          memory.searchRepository,
          work,
          CLOCK,
          stationsFor(memory, work),
          TRANSACTION,
        ).execute(
          new AddReplaySetEntryCommand('team_1', 'set_1', 'run_9', PERSON),
        ),
      ),
    ).toBe('conflict');
    expect(
      await errorOf(
        new RemoveReplaySetEntryHandler(
          accessFor(memory, work),
          memory.setRepository,
          memory.searchRepository,
          TRANSACTION,
        ).execute(
          new RemoveReplaySetEntryCommand(
            'team_1',
            'set_1',
            'original_0',
            PERSON,
          ),
        ),
      ),
    ).toBe('conflict');
    expect(
      await errorOf(
        new DeleteReplaySetHandler(
          accessFor(memory, work),
          memory.setRepository,
          memory.replayRepository,
          memory.searchRepository,
          TRANSACTION,
        ).execute(new DeleteReplaySetCommand('team_1', 'set_1', PERSON)),
      ),
    ).toBe('conflict');
  });

  it('changes again once the search ended', async () => {
    const search = await memory.searchRepository.find(SEARCH_ID);

    await memory.searchRepository.save(
      search?.stop(NOW, BY) ?? expect.unreachable(),
    );
    await new RemoveReplaySetEntryHandler(
      accessFor(memory, work),
      memory.setRepository,
      memory.searchRepository,
      TRANSACTION,
    ).execute(
      new RemoveReplaySetEntryCommand('team_1', 'set_1', 'original_0', PERSON),
    );

    expect(memory.sets.get('set_1')?.runs).toHaveLength(9);
  });
});
