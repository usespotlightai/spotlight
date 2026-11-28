import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const RUN_REQUESTER_LABELS = Symbol('RUN_REQUESTER_LABELS');

export type LabelledRequester = RunRequesterContract;

/**
 * Who sees a run's title: whoever may read the run itself, whoever may read the run its work is for (the task run a
 * judge judges), or the members of a team. `opens` links the title to the run they read. `hidden` is what a viewer
 * who may not read the run itself sees instead, in the owner's words.
 */
type LabelReaders =
  | {
      readonly of: 'the-run';
      readonly opens: boolean;
      readonly hidden: string;
    }
  | { readonly of: 'run'; readonly runId: RunId; readonly opens: boolean }
  | { readonly of: 'team-members'; readonly teamId: TeamId };

export interface RequesterLabel {
  /** What the run does, in plain words: a task's title, or "Checking proposed memories". */
  readonly title: string;
  readonly readers: LabelReaders;
}

export const requesterRefOf = (
  requester: Pick<RunRequesterContract, 'owner' | 'kind' | 'id'>,
): string => `${requester.owner}/${requester.kind}/${requester.id}`;

export interface RunRequesterLabelSource {
  readonly owner: string;

  labelsOf(
    requesters: readonly LabelledRequester[],
  ): Promise<ReadonlyMap<string, RequesterLabel>>;
}

export interface RunRequesterLabelsPort {
  register(source: RunRequesterLabelSource): void;
}
