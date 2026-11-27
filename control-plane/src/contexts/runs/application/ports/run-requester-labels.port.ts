import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const RUN_REQUESTER_LABELS = Symbol('RUN_REQUESTER_LABELS');

export type LabelledRequester = RunRequesterContract;

interface RequesterStation {
  readonly lineId: string;
  readonly stationId: string;
}

export interface RequesterLabel {
  readonly title: string;
  readonly station: RequesterStation | null;
}

export const requesterRefOf = (
  requester: Pick<RunRequesterContract, 'owner' | 'kind' | 'id'>,
): string => `${requester.owner}/${requester.kind}/${requester.id}`;

/**
 * Labels the runs an owner requested. A run its requester lists shows its label only to a viewer who reads the run; a run its requester does not list shows the label its owner gives for the viewer, so a source labels such a run only for a viewer it lets see it.
 */
export interface RunRequesterLabelSource {
  readonly owner: string;

  labelsOf(
    requesters: readonly LabelledRequester[],
    viewer: UserId,
  ): Promise<ReadonlyMap<string, RequesterLabel>>;
}

export interface RunRequesterLabelsPort {
  register(source: RunRequesterLabelSource): void;
}
