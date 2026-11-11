import type { RunRequesterContract } from '@runs/application/contracts/run-order.contract';

export const RUN_REQUESTER_LABELS = Symbol('RUN_REQUESTER_LABELS');

export type LabelledRequester = RunRequesterContract;

export interface RequesterLabel {
  readonly title: string;
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
