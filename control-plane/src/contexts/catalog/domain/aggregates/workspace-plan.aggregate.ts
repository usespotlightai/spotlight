import { WorkspacePlanCreated } from '@catalog/domain/events/workspace-plan-created.event';
import { WorkspacePlanDeleted } from '@catalog/domain/events/workspace-plan-deleted.event';
import { WorkspacePlanUpdated } from '@catalog/domain/events/workspace-plan-updated.event';
import { PlanTerm } from '@catalog/domain/value-objects/plan-term.vo';
import { WorkspacePlanChangeDetail } from '@catalog/domain/value-objects/workspace-plan-change-detail.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

// A stored plan never holds the free plan: a workspace without one has the free plan.
export class WorkspacePlan extends EventRecorder {
  private constructor(
    readonly workspaceId: WorkspaceId,
    readonly term: PlanTerm,
    readonly version: number,
    readonly isDeleted: boolean,
  ) {
    super();
  }

  // The plan to store after the change, or null when nothing is to be stored or changed.
  static set(
    current: WorkspacePlan | null,
    input: { workspaceId: WorkspaceId; term: PlanTerm; by: ChangeActor },
  ): WorkspacePlan | null {
    if (current && !current.workspaceId.equals(input.workspaceId)) {
      throw new InconsistentStateError(
        'workspace plan',
        `of ${current.workspaceId.value} was set for ${input.workspaceId.value}`,
      );
    }

    if (!current) {
      return input.term.isDefault
        ? null
        : WorkspacePlan.create(input.workspaceId, input.term, input.by);
    }

    if (input.term.isDefault) {
      return current.delete(input.by);
    }

    return input.term.equals(current.term)
      ? null
      : current.update(input.term, input.by);
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

  delete(by: ChangeActor): WorkspacePlan {
    this.assertNotDeleted();

    const deleted = this.with(this.term, true);

    deleted.record(
      new WorkspacePlanDeleted(
        this.workspaceId,
        this.term,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  private static create(
    workspaceId: WorkspaceId,
    term: PlanTerm,
    by: ChangeActor,
  ): WorkspacePlan {
    const created = new WorkspacePlan(workspaceId, term, 0, false);

    created.record(
      new WorkspacePlanCreated(
        workspaceId,
        term,
        ConfigurationChange.created(
          created.whatChanged,
          by,
          WorkspacePlanChangeDetail.of(term),
        ),
      ),
    );

    return created;
  }

  private update(term: PlanTerm, by: ChangeActor): WorkspacePlan {
    this.assertNotDeleted();

    const updated = this.with(term, false);

    updated.record(
      new WorkspacePlanUpdated(
        this.workspaceId,
        term,
        this.term,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          WorkspacePlanChangeDetail.of(term),
        ),
      ),
    );

    return updated;
  }

  private get whatChanged() {
    return {
      resource: 'workspace-plan' as const,
      id: this.workspaceId.value,
      key: 'plan',
    };
  }

  private assertNotDeleted(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'workspace plan',
        'was changed after it was deleted',
      );
    }
  }

  private with(term: PlanTerm, deleted: boolean): WorkspacePlan {
    const next = new WorkspacePlan(
      this.workspaceId,
      term,
      this.version,
      deleted,
    );
    next.inheritEvents(this);

    return next;
  }
}
