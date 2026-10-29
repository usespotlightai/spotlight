import type {
  StationChangeTestOutcome,
  StationChangeTestScope,
  StationChangeToolRefusal,
} from '@work/application/ports/station-change-tests.port';

const INBOX =
  'The result arrives in the inbox of the person. Tell them what happens next. Do not show a Terraform diff.';

const FALLBACK =
  'Tell the person the reason. Then show the change as a Terraform diff for a person to apply.';

const PULL_REQUEST =
  'If the change passes the gates of the line, Spotlight opens a config pull request.';

const plural = (count: number, word: string): string =>
  `${count} ${word}${count === 1 ? '' : 's'}`;

const replayed = (scope: StationChangeTestScope): string =>
  `Spotlight replays the live config and the change on ${plural(scope.searchedTasks, 'searched task')}. If the change does better, Spotlight replays it on ${plural(scope.heldOutTasks, 'held-out task')}.`;

const refinement = (scope: StationChangeTestScope): readonly string[] =>
  scope.mode === 'search' && scope.iterations > 1
    ? [
        `Then the search agent can refine the change in up to ${plural(scope.iterations - 1, 'more iteration')}.`,
      ]
    : [];

const refusal = (
  code: StationChangeToolRefusal,
  reason: string,
  problems: readonly string[] = [],
): Readonly<Record<string, unknown>> => ({
  started: false,
  refusal: code,
  reason,
  ...(problems.length > 0 ? { problems } : {}),
  next:
    problems.length > 0 ? 'Fix the change and call the tool again.' : FALLBACK,
});

export const StationChangeTestAnswer = {
  of(outcome: StationChangeTestOutcome): Readonly<Record<string, unknown>> {
    switch (outcome.outcome) {
      case 'started':
        return {
          started: true,
          outcome: 'started',
          mode: outcome.mode,
          next: [
            replayed(outcome),
            ...refinement(outcome),
            PULL_REQUEST,
            INBOX,
          ].join(' '),
        };
      case 'joined':
        return {
          started: true,
          outcome: 'joined',
          mode: outcome.mode,
          next: [
            `A search of the station is running. The change joined it as one candidate of iteration ${outcome.iteration} of ${outcome.iterations}.`,
            ...(outcome.mode === 'search'
              ? [
                  'The change gets no search of its own, and no refinement of its own.',
                ]
              : []),
            `Spotlight replays it on ${plural(outcome.searchedTasks, 'searched task')}, and on ${plural(outcome.heldOutTasks, 'held-out task')} if it does better.`,
            PULL_REQUEST,
            INBOX,
          ].join(' '),
        };
      case 'invalid':
        return refusal(
          'invalid-change',
          'Spotlight rejected the change.',
          outcome.problems.map(
            (each) => `${each.path || 'config'}: ${each.reason}`,
          ),
        );
      case 'refused':
        return refusal(outcome.code, outcome.reason);
    }
  },

  refused(
    code: StationChangeToolRefusal,
    reason: string,
  ): Readonly<Record<string, unknown>> {
    return refusal(code, reason);
  },
};
