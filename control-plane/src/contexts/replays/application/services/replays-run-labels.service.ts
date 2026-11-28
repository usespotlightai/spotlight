import {
  REPLAY_RUN_TITLE,
  SEARCH_RUN_TITLE,
} from '@replays/application/rendering/replays-run-title.text';
import {
  REPLAYS_OWNER,
  ReplaysRequester,
} from '@replays/domain/value-objects/replays-requester.vo';
import {
  type LabelledRequester,
  type RequesterLabel,
  type RunRequesterLabelSource,
  requesterRefOf,
} from '@runs/application/ports/run-requester-labels.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

/**
 * Names replay runs and search runs by what they do. Like the replays and searches themselves, they show only to the
 * members of the team of the run.
 */
export class ReplaysRunLabels implements RunRequesterLabelSource {
  readonly owner = REPLAYS_OWNER;

  async labelsOf(
    requesters: readonly LabelledRequester[],
  ): Promise<ReadonlyMap<string, RequesterLabel>> {
    return new Map(
      requesters.flatMap((requester) => {
        const replays = ReplaysRequester.decode(requester);

        return replays && nonEmpty(requester.team)
          ? [
              [
                requesterRefOf(requester),
                {
                  title: replays.isReplay ? REPLAY_RUN_TITLE : SEARCH_RUN_TITLE,
                  readers: {
                    of: 'team-members',
                    teamId: TeamId.of(requester.team),
                  },
                },
              ] as const,
            ]
          : [];
      }),
    );
  }
}
