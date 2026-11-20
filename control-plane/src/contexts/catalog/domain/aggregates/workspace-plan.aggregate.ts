import { WorkspacePlanChanged } from '@catalog/domain/events/workspace-plan-changed.event';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { WorkspacePlanChangeDetail } from '@catalog/domain/value-objects/workspace-plan-change-detail.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// A workspace without a stored plan has the free plan, with no end.
export class WorkspacePlan extends EventRecorder {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly term: PlanTerm,
    readonly version: number,
    readonly isRemoved: boolean,
  ) {
    super();
  }

  static assign(input: {
    workspaceId: WorkspaceId;
    term: PlanTerm;
    by: ChangeActor;
  }): WorkspacePlan {
    const assigned = new WorkspacePlan(input.workspaceId, input.term, 0, false);

    assigned.recordChange(PlanTerm.free, input.by);

    return assigned;
  }

  static rehydrate(input: {
    workspaceId: WorkspaceId;
    term: PlanTerm;
    version: number;
  }): WorkspacePlan {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'workspace plan',
        `has an impossible version (${input.version})`,
      );
    }

    return new WorkspacePlan(
      input.workspaceId,
      input.term,
      input.version,
      false,
    );
  }

  changeTo(term: PlanTerm, by: ChangeActor): WorkspacePlan {
    this.assertNotRemoved();

    if (term.isDefault) {
      return this.remove(by);
    }

    if (term.equals(this.term)) {
      return this;
    }

    const changed = this.with(term, false);
    changed.recordChange(this.term, by);

    return changed;
  }

  remove(by: ChangeActor): WorkspacePlan {
    this.assertNotRemoved();

    const removed = this.with(PlanTerm.free, true);

    if (!this.term.isDefault) {
      removed.recordChange(this.term, by);
    }

    return removed;
  }

  private recordChange(previous: PlanTerm, by: ChangeActor): void {
    this.record(
      new WorkspacePlanChanged(
        this.workspaceId,
        this.term,
        previous,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          WorkspacePlanChangeDetail.of(this.term),
        ),
      ),
    );
  }

  private get whatChanged() {
    return {
      resource: 'workspace-plan' as const,
      id: this.workspaceId.value,
      key: 'plan',
    };
  }

  private assertNotRemoved(): void {
    if (this.isRemoved) {
      throw new InconsistentStateError(
        'workspace plan',
        'was changed after it was removed',
      );
    }
  }

  private with(term: PlanTerm, removed: boolean): WorkspacePlan {
    const next = new WorkspacePlan(
      this.workspaceId,
      term,
      this.version,
      removed,
    );
    next.inheritEvents(this);

    return next;
  }
}
