import { MonthlyCeilingReachedError } from '@replays/domain/exceptions/monthly-ceiling-reached.error';
import {
  fitsMonthAfter,
  monthStartOf,
  type SpendingSearch,
} from '@replays/domain/services/search-schedule';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface SearchAdmission {
  readonly searchId: SearchId;
  readonly ceiling: Money;
}

export interface StartedSearch extends SpendingSearch {
  readonly id: SearchId;
}

interface State {
  readonly lineId: LineId;
  readonly month: Date;
  readonly workspaceId: WorkspaceId;
  readonly teamId: TeamId;
  readonly admissions: readonly SearchAdmission[];
  readonly version: number;
}

const HOLDER = 'line search budget';

export class LineSearchBudget extends EventRecorder {
  private constructor(
    private readonly state: State,
    readonly isDeleted = false,
  ) {
    super();
  }

  static open(input: {
    lineId: LineId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    at: Date;
  }): LineSearchBudget {
    return new LineSearchBudget({
      lineId: input.lineId,
      month: monthStartOf(input.at),
      workspaceId: input.workspaceId,
      teamId: input.teamId,
      admissions: [],
      version: 0,
    });
  }

  static rehydrate(state: State): LineSearchBudget {
    if (state.month.getTime() !== monthStartOf(state.month).getTime()) {
      throw new InconsistentStateError(
        HOLDER,
        'starts at the start of a month',
      );
    }
    if (
      state.admissions.some((each, at) =>
        state.admissions
          .slice(0, at)
          .some((other) => other.searchId.equals(each.searchId)),
      )
    ) {
      throw new InconsistentStateError(HOLDER, 'admits each search once');
    }

    return new LineSearchBudget({
      ...state,
      admissions: [...state.admissions],
    });
  }

  get lineId(): LineId {
    return this.state.lineId;
  }

  get month(): Date {
    return this.state.month;
  }

  get workspaceId(): WorkspaceId {
    return this.state.workspaceId;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get admissions(): readonly SearchAdmission[] {
    return this.state.admissions;
  }

  get version(): number {
    return this.state.version;
  }

  admits(searchId: SearchId): boolean {
    return this.state.admissions.some((each) => each.searchId.equals(searchId));
  }

  admit(
    admission: SearchAdmission,
    policy: SearchPolicy,
    startedThisMonth: readonly StartedSearch[],
  ): LineSearchBudget {
    if (this.admits(admission.searchId)) {
      return this;
    }

    const notStartedYet = this.state.admissions
      .filter(
        (each) =>
          !startedThisMonth.some((started) => started.id.equals(each.searchId)),
      )
      .map(
        (each): SpendingSearch => ({
          isActive: true,
          spent: Money.none(each.ceiling.currency),
          budget: { ceiling: each.ceiling },
        }),
      );

    if (!fitsMonthAfter(policy, [...startedThisMonth, ...notStartedYet])) {
      throw new MonthlyCeilingReachedError(this.state.lineId);
    }

    return this.with({
      admissions: [...this.state.admissions, admission],
    });
  }

  withdrawn(searchId: SearchId): LineSearchBudget {
    return this.admits(searchId)
      ? this.with({
          admissions: this.state.admissions.filter(
            (each) => !each.searchId.equals(searchId),
          ),
        })
      : this;
  }

  delete(): LineSearchBudget {
    const deleted = new LineSearchBudget(this.state, true);

    deleted.inheritEvents(this);

    return deleted;
  }

  private with(part: Partial<State>): LineSearchBudget {
    const next = new LineSearchBudget(
      { ...this.state, ...part },
      this.isDeleted,
    );

    next.inheritEvents(this);

    return next;
  }
}
