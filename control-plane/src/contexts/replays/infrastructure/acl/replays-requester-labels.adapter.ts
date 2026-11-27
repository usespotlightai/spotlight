import type { ReplayRunLabels } from '@replays/application/services/replay-run-labels.service';
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
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class ReplaysRequesterLabels implements RunRequesterLabelSource {
  readonly owner = REPLAYS_OWNER;

  readonly checksViewer = true;

  constructor(private readonly labels: ReplayRunLabels) {}

  async labelsOf(
    requesters: readonly LabelledRequester[],
    viewer: UserId,
  ): Promise<ReadonlyMap<string, RequesterLabel>> {
    const labels = await this.labels.of(
      requesters.flatMap((each) => {
        const run = ReplaysRequester.decode(each)?.replayRun;

        return run ? [run] : [];
      }),
      viewer,
    );

    return new Map(
      labels.map(
        (each) =>
          [
            requesterRefOf(ReplaysRequester.replayOf(each.run).encoded()),
            {
              title: each.title,
              station: each.station && {
                lineId: each.station.lineId.value,
                stationId: each.station.stationId.value,
              },
            },
          ] as const,
      ),
    );
  }
}
