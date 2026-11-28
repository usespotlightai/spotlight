import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

/**
 * Who a run's requester says may read its title: whoever may read the run itself (others see `hidden` instead),
 * whoever may read the run its work is for, or the members of a team.
 */
export type TitleReaders =
  | { readonly of: 'the-run'; readonly opens: boolean; readonly hidden: string }
  | { readonly of: 'run'; readonly runId: RunId; readonly opens: boolean }
  | { readonly of: 'team-members'; readonly teamId: TeamId };

/** A run as the audience of a title sees it, with the readers its requester names; null where it names none. */
export interface AudienceRun {
  readonly runId: RunId;
  readonly teamId: string | null;
  readonly listed: boolean;
  readonly readers: TitleReaders | null;
}

/** Who reads the title: the readers of a listed run (others see `hidden`, or the team sentence), a team, or no one. */
type TitleGate =
  | {
      readonly by: 'run';
      readonly runId: RunId;
      readonly hidden: string | null;
    }
  | { readonly by: 'team'; readonly teamId: TeamId }
  | { readonly by: 'nobody' };

interface OpenedRun {
  readonly runId: string;
  readonly teamId: string;
}

export type TitleAudienceState =
  | {
      readonly status: 'follows';
      readonly runId: RunId;
      /** The work's title opens the run it follows, where that run's own title would. */
      readonly opens: boolean;
    }
  | {
      readonly status: 'decided';
      readonly gate: TitleGate;
      readonly opens: OpenedRun | null;
    };

export type ShownTitle =
  | { readonly shows: 'title'; readonly opens: OpenedRun | null }
  | { readonly shows: 'hidden'; readonly hidden: string | null }
  | { readonly shows: 'nothing' };

const openedOf = (run: AudienceRun, opens: boolean): OpenedRun | null =>
  opens && run.teamId !== null
    ? { runId: run.runId.value, teamId: run.teamId }
    : null;

const decided = (
  gate: TitleGate,
  opens: OpenedRun | null = null,
): TitleAudienceState => ({ status: 'decided', gate, opens });

const NOBODY = decided({ by: 'nobody' });

const teamOf = (teamId: TeamId): TitleAudienceState =>
  decided({ by: 'team', teamId });

/**
 * Finds who may read a run's title from the readers its requester names. Work for another run follows that run: a
 * listed run's readers read it, an unlisted run's requester names the readers in turn, and where the run is gone the
 * members of the work's own team do.
 */
export const TitleAudience = {
  /** Work for work for a run, such as a judging of an assist session's run, follows two runs; none goes further. */
  MOST_FOLLOWED: 2,

  of(
    run: AudienceRun & { readonly readers: TitleReaders },
  ): TitleAudienceState {
    const { readers } = run;

    switch (readers.of) {
      case 'the-run':
        return run.listed
          ? decided(
              { by: 'run', runId: run.runId, hidden: readers.hidden },
              openedOf(run, readers.opens),
            )
          : NOBODY;
      case 'team-members':
        return teamOf(readers.teamId);
      case 'run':
        return {
          status: 'follows',
          runId: readers.runId,
          opens: readers.opens,
        };
    }
  },

  following(
    state: Extract<TitleAudienceState, { status: 'follows' }>,
    work: AudienceRun,
    followed: AudienceRun | null,
  ): TitleAudienceState {
    if (!followed) {
      return work.teamId === null ? NOBODY : teamOf(TeamId.of(work.teamId));
    }

    const readers = followed.readers;

    if (followed.listed) {
      return decided(
        {
          by: 'run',
          runId: followed.runId,
          hidden: readers?.of === 'the-run' ? readers.hidden : null,
        },
        openedOf(
          followed,
          state.opens && readers?.of === 'the-run' && readers.opens,
        ),
      );
    }

    if (readers?.of === 'team-members') {
      return teamOf(readers.teamId);
    }

    return readers?.of === 'run' ? { ...state, runId: readers.runId } : NOBODY;
  },

  /** What the viewer sees: the title where they read its gate, why it is hidden where not, and nothing where no one reads it. */
  shown(state: TitleAudienceState, reads: boolean): ShownTitle {
    if (state.status === 'follows' || state.gate.by === 'nobody') {
      return { shows: 'nothing' };
    }

    if (reads) {
      return { shows: 'title', opens: state.opens };
    }

    return {
      shows: 'hidden',
      hidden: state.gate.by === 'run' ? state.gate.hidden : null,
    };
  },
};
