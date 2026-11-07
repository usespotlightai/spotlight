import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { RunRequester } from '@work/domain/value-objects/run-requester.vo';
import type { RunSubject } from '@work/domain/value-objects/run-subject.vo';

export const requesterOf = (
  run: RunId,
  subject: RunSubject | null,
  team: TeamId | null,
): RunRequester => {
  if (!subject) {
    return RunRequester.of({
      owner: 'workspace',
      kind: 'spec',
      id: run.value,
      team,
    });
  }

  return subject.match<RunRequester>({
    task: (taskId, _station, revision) =>
      RunRequester.of({
        owner: 'work',
        kind: 'task',
        id: taskId.value,
        token: String(revision.value),
        team,
      }),
    chat: (chatId) =>
      RunRequester.of({ owner: 'work', kind: 'chat', id: chatId.value, team }),
    replay: (_original, _task, _station, ranFor) =>
      RunRequester.of({
        owner: 'replays',
        kind: 'replay',
        id: run.value,
        team: ranFor,
      }),
    search: (searchId, iteration, _station, ranFor) =>
      RunRequester.of({
        owner: 'replays',
        kind: 'search',
        id: searchId.value,
        token: String(iteration.value),
        team: ranFor,
      }),
  });
};
