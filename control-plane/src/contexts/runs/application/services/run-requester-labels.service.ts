import type {
  LabelledRequester,
  RequesterLabel,
  RunRequesterLabelSource,
  RunRequesterLabelsPort,
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
  ): Promise<ReadonlyMap<string, RequesterLabel>> {
    const byOwner = new Map<string, LabelledRequester[]>();

    for (const requester of requesters) {
      byOwner.set(requester.owner, [
        ...(byOwner.get(requester.owner) ?? []),
        requester,
      ]);
    }

    const labelled = await Promise.all(
      [...byOwner].map(
        async ([owner, owned]) =>
          (await this.sources.get(owner)?.labelsOf(owned, viewer)) ?? new Map(),
      ),
    );

    return new Map(labelled.flatMap((labels) => [...labels]));
  }
}
