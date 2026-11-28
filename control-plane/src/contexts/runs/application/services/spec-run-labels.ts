import type {
  LabelledRequester,
  RequesterLabel,
  RunRequesterLabelSource,
} from '@runs/application/ports/run-requester-labels.port';
import { requesterRefOf } from '@runs/application/ports/run-requester-labels.port';
import {
  QUEUED_BY_HAND_TITLE,
  TEAM_HIDDEN_TITLE,
} from '@runs/application/rendering/run-title.text';

/** The requester of a run that a workspace queues by hand, with its own spec. */
export const SPEC_REQUESTER = { owner: 'workspace', kind: 'spec' } as const;

const QUEUED_BY_HAND: RequesterLabel = {
  title: QUEUED_BY_HAND_TITLE,
  readers: { of: 'the-run', opens: false, hidden: TEAM_HIDDEN_TITLE },
};

export class SpecRunLabels implements RunRequesterLabelSource {
  readonly owner = SPEC_REQUESTER.owner;

  async labelsOf(
    requesters: readonly LabelledRequester[],
  ): Promise<ReadonlyMap<string, RequesterLabel>> {
    return new Map(
      requesters
        .filter((each) => each.kind === SPEC_REQUESTER.kind)
        .map((each) => [requesterRefOf(each), QUEUED_BY_HAND] as const),
    );
  }
}
