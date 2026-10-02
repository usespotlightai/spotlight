import { AddReplaySetEntryCommand } from '@replays/application/commands/add-replay-set-entry.command';
import { DeleteReplaySetCommand } from '@replays/application/commands/delete-replay-set.command';
import { AddReplaySetEntryHandler } from '@replays/application/commands/handlers/add-replay-set-entry.handler';
import { DeleteReplaySetHandler } from '@replays/application/commands/handlers/delete-replay-set.handler';
import { OpenReplaySetHandler } from '@replays/application/commands/handlers/open-replay-set.handler';
import { RemoveReplaySetEntryHandler } from '@replays/application/commands/handlers/remove-replay-set-entry.handler';
import { OpenReplaySetCommand } from '@replays/application/commands/open-replay-set.command';
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
import { aReplay, aSet, STATION } from '@replays/domain/replays.fake-spec';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { beforeEach, describe, expect, it } from 'vitest';

let memory: InMemoryReplays;
let work: FakeWork;

const faultOf = async (asked: Promise<unknown>) =>
  asked.then(
    () => {
      throw new Error('it was allowed');
    },
    (error: unknown) => {
      if (error instanceof UseCaseFault) {
        return error.kind;
      }
      throw error;
    },
  );

beforeEach(() => {
  memory = new InMemoryReplays();
  work = new FakeWork();
});

describe('OpenReplaySetHandler', () => {
  const opening = (mayPlan: boolean | null) =>
    new OpenReplaySetHandler(
      accessFor(memory, work, mayPlan),
      memory.setRepository,
      IDS,
      CLOCK,
    );

  it('opens an empty set at a station of the team', async () => {
    const opened = await opening(true).execute(
      new OpenReplaySetCommand(
        'team_1',
        'line_1',
        'station_build',
        'Queue fixes',
        PERSON,
      ),
    );

    expect(opened.outcome).toBe('opened');
    expect([...memory.sets.values()][0]?.name.value).toBe('Queue fixes');
  });

  it('refuses one who may read the team but not plan', async () => {
    expect(
      await opening(false).execute(
        new OpenReplaySetCommand(
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
      await faultOf(
        opening(null).execute(
          new OpenReplaySetCommand(
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
      await faultOf(
        opening(true).execute(
          new OpenReplaySetCommand(
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
      work,
      CLOCK,
      stationsFor(memory, work),
    );

  beforeEach(async () => {
    await memory.setRepository.add(aSet());
  });

  it('notes a set whose station Work no longer has, and adds nothing to it', async () => {
    work.station = async () => null;

    expect(
      await faultOf(
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
      refusal: null,
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

  it('refuses a run Work cannot replay, or knows nothing of', async () => {
    work.replayables.set('run_1', {
      runId: RunId.of('run_1'),
      taskId: TaskId.of('task_1'),
      stationId: STATION.stationId,
      refusal: 'archive-gone',
      reason: 'the archive is gone',
    });

    expect(
      await faultOf(
        adding().execute(
          new AddReplaySetEntryCommand('team_1', 'set_1', 'run_1', PERSON),
        ),
      ),
    ).toBe('conflict');
    expect(
      await faultOf(
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
      TRANSACTION,
    );

  it('refuses while a replay of the set is underway', async () => {
    await memory.setRepository.add(aSet(1));
    await memory.replayRepository.add(aReplay({ count: 1 }));

    expect(
      await faultOf(
        deleting().execute(
          new DeleteReplaySetCommand('team_1', 'set_1', PERSON),
        ),
      ),
    ).toBe('conflict');
  });

  it('deletes a set nothing of is underway', async () => {
    await memory.setRepository.add(aSet(1));

    await deleting().execute(
      new DeleteReplaySetCommand('team_1', 'set_1', PERSON),
    );

    expect(memory.sets.size).toBe(0);
  });
});
