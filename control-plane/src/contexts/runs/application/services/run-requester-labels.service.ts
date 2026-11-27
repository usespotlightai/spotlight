import type {
  LabelledRequester,
  RunRequesterLabelSource,
  RunRequesterLabelsPort,
  ViewedLabel,
} from '@runs/application/ports/run-requester-labels.port';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class RunRequesterLabels implements RunRequesterLabelsPort {
  private readonly sources = new Map<string, RunRequesterLabelSource>();

  register(source: RunRequesterLabelSource): void {
    this.sources.set(source.owner, source);
  }

  async labelsOf(
    requesters: readonly LabelledRequester[],
    viewer: UserId,
  ): Promise<ReadonlyMap<string, ViewedLabel>> {
    const byOwner = new Map<string, LabelledRequester[]>();

    for (const requester of requesters) {
      byOwner.set(requester.owner, [
        ...(byOwner.get(requester.owner) ?? []),
        requester,
      ]);
    }

    const labelled = await Promise.all(
      [...byOwner].map(async ([owner, owned]) => {
        const source = this.sources.get(owner);
        const labels = (await source?.labelsOf(owned, viewer)) ?? new Map();

        return new Map(
          [...labels].map(([ref, label]) => [
            ref,
            { ...label, checkedForViewer: source?.checksViewer ?? false },
          ]),
        );
      }),
    );

    return new Map(labelled.flatMap((labels) => [...labels]));
  }
}
