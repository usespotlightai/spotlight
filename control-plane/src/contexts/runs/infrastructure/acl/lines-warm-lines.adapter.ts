import type { LineView } from '@lines/application/contracts/line-view.contract';
import type { LinesPort } from '@lines/application/ports/lines.port';
import { checkoutPathOf } from '@runs/application/contracts/run-spec.contract';
import type { WarmLinesPort } from '@runs/application/ports/warm-lines.port';
import type { WarmLine } from '@runs/domain/value-objects/warm-line.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const warmLineOf = (view: LineView): WarmLine => ({
  id: LineId.of(view.id),
  workspaceId: WorkspaceId.of(view.workspaceId),
  checkouts: view.repositories.map((each) => ({
    path: checkoutPathOf(Repository.of(each.repository)),
    setup: each.setup,
  })),
  placement: RunnerPlacement.of(view.runners).in(
    view.image === null ? null : RunnerImage.of(view.image),
  ),
  warmSandboxes: view.warmSandboxes,
});

export class LinesWarmLines implements WarmLinesPort {
  constructor(private readonly lines: LinesPort) {}

  async keepingWarmSandboxes(): Promise<readonly WarmLine[]> {
    return (await this.lines.keepingWarmSandboxes()).map(warmLineOf);
  }
}
