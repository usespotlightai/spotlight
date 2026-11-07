import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { policyOf } from '@work/domain/services/policy-of';
import { requesterOf } from '@work/domain/services/requester-of';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { SearchId } from '@work/domain/value-objects/search-id.vo';
import { SearchIteration } from '@work/domain/value-objects/search-iteration.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it } from 'vitest';

const RUN = RunId.of('run_2');
const TEAM = TeamId.of('team_1');
const STATION = StationId.of('station_1');

const described = (subject: RunSubject | null, team: TeamId | null) => {
  const requester = requesterOf(RUN, subject, team);

  return {
    subject: requester.subject,
    token: requester.token,
    team: requester.team?.value ?? null,
    policy: policyOf(subject).parts,
  };
};

describe('the requester and policy derived from a run’s subject', () => {
  it('says a task run is Work’s, holds the turn and is gated', () => {
    expect(
      described(
        RunSubject.task(TaskId.of('task_1'), STATION, TaskRevision.of(3)),
        TEAM,
      ),
    ).toEqual({
      subject: 'work/task/task_1',
      token: '3',
      team: 'team_1',
      policy: {
        holdsTurn: true,
        gated: true,
        actsBeyondItself: true,
        asks: 'requester',
        listed: true,
        exclusive: true,
      },
    });
  });

  it('says a chat run is Work’s and runs one at a time', () => {
    expect(described(RunSubject.chat(ChatId.of('chat_1')), TEAM)).toMatchObject(
      {
        subject: 'work/chat/chat_1',
        policy: { holdsTurn: false, gated: false, exclusive: true },
      },
    );
  });

  it('names a replay by its own run id and isolates it', () => {
    expect(
      described(
        RunSubject.replay(
          RunId.of('run_1'),
          TaskId.of('task_1'),
          STATION,
          TEAM,
        ),
        null,
      ),
    ).toEqual({
      subject: 'replays/replay/run_2',
      token: null,
      team: 'team_1',
      policy: {
        holdsTurn: false,
        gated: false,
        actsBeyondItself: false,
        asks: 'recorded',
        listed: false,
        exclusive: false,
      },
    });
  });

  it('names a search by its search and iteration', () => {
    expect(
      described(
        RunSubject.search(
          SearchId.of('search_1'),
          SearchIteration.of(4),
          STATION,
          TEAM,
        ),
        null,
      ),
    ).toMatchObject({
      subject: 'replays/search/search_1',
      token: '4',
      policy: { actsBeyondItself: false, listed: false },
    });
  });

  it('says a raw-spec run is the workspace’s own', () => {
    expect(described(null, null)).toMatchObject({
      subject: 'workspace/spec/run_2',
      team: null,
      policy: { actsBeyondItself: true, listed: true, exclusive: false },
    });
  });
});
