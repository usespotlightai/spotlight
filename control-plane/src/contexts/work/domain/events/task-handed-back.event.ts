import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { CheckoutHead } from '@work/domain/value-objects/checkout-head.vo';
import type { HandBack } from '@work/domain/value-objects/hand-back';
import type { TakeoverId } from '@work/domain/value-objects/takeover-id.vo';
import type { TakeoverVerdict } from '@work/domain/value-objects/takeover-verdict';

export class TaskHandedBack implements DomainEvent {
  readonly kind = 'task.handed-back';

  constructor(
    readonly taskId: TaskId,
    readonly workspaceId: WorkspaceId,
    readonly teamId: TeamId,
    readonly takeoverId: TakeoverId,
    readonly stationId: StationId,
    readonly by: UserId,
    readonly from: RunId | null,
    readonly verdict: TakeoverVerdict,
    readonly handBack: HandBack,
    readonly turns: readonly RunId[],
    readonly fromHeads: readonly CheckoutHead[],
    readonly toHeads: readonly CheckoutHead[],
    readonly startedAt: Date,
    readonly endedAt: Date,
  ) {}
}
