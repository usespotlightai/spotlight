import type {
  WorkspaceAccessPort,
  WorkspaceMembership,
} from '@identity/application/ports/workspace-access.port';
import {
  type RequesterLabel,
  requesterRefOf,
} from '@runs/application/ports/run-requester-labels.port';
import type { RunnerActivityReaderPort } from '@runs/application/ports/runner-activity-reader.port';
import {
  TEAM_HIDDEN_TITLE,
  UNNAMED_RUN_TITLE,
} from '@runs/application/rendering/run-title.text';
import type { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import type {
  ListedRun,
  RunViewing,
} from '@runs/application/services/run-viewing.service';
import {
  type AudienceRun,
  TitleAudience,
  type TitleAudienceState,
} from '@runs/domain/services/title-audience';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export interface TitledRun extends ListedRun {
  readonly teamId: string | null;
}

/**
 * What the viewer sees of a run: its title when they may read it, with the run it opens, or why it is hidden from
 * them.
 */
export type RunTitle =
  | {
      readonly title: string;
      readonly hiddenReason: null;
      readonly link: { readonly runId: string; readonly teamId: string } | null;
    }
  | {
      readonly title: null;
      readonly hiddenReason: string;
      readonly link: null;
    };

/** The workspace whose runs are titled, by its id and its slug. */
type TitledWorkspace = Pick<WorkspaceMembership, 'workspaceId' | 'slug'>;

export const UNNAMED_RUN: RunTitle = {
  title: UNNAMED_RUN_TITLE,
  hiddenReason: null,
  link: null,
};

const unique = (runIds: readonly RunId[]): RunId[] =>
  runIds.filter(
    (each, at) => runIds.findIndex((other) => other.equals(each)) === at,
  );

/** Titles runs for a viewer: each context names its runs, and the domain decides who may read each name. */
export class RunTitles {
  constructor(
    private readonly labels: RunRequesterLabels,
    private readonly viewers: RunViewing,
    private readonly activity: RunnerActivityReaderPort,
    private readonly access: WorkspaceAccessPort,
  ) {}

  async of(
    workspace: TitledWorkspace,
    runs: readonly TitledRun[],
    viewer: UserId,
  ): Promise<ReadonlyMap<string, RunTitle>> {
    const labels = new Map(
      await this.labels.labelsOf(runs.map((each) => each.requester)),
    );
    const labelOf = (run: TitledRun): RequesterLabel | null =>
      labels.get(requesterRefOf(run.requester)) ?? null;
    const audienceOf = (run: TitledRun): AudienceRun => ({
      runId: run.runId,
      teamId: run.teamId,
      listed: run.policy.listed,
      readers: labelOf(run)?.readers ?? null,
    });
    const known = new Map<string, TitledRun>(
      runs.map((each) => [each.runId.value, each]),
    );
    const states = new Map<string, TitleAudienceState>(
      runs.flatMap((run) => {
        const readers = labelOf(run)?.readers;

        return readers
          ? [
              [
                run.runId.value,
                TitleAudience.of({ ...audienceOf(run), readers }),
              ] as const,
            ]
          : [];
      }),
    );

    for (let hop = 0; hop < TitleAudience.MOST_FOLLOWED; hop += 1) {
      const following = [...states].flatMap(([runId, state]) =>
        state.status === 'follows' ? [{ runId, state }] : [],
      );

      if (following.length === 0) {
        break;
      }

      const found = await this.activity.runsOf(
        workspace.workspaceId,
        unique(following.map(({ state }) => state.runId)),
      );
      const unlabelled = found.filter((each) => labelOf(each) === null);

      for (const each of found) {
        known.set(each.runId.value, each);
      }

      if (unlabelled.length > 0) {
        for (const [ref, label] of await this.labels.labelsOf(
          unlabelled.map((each) => each.requester),
        )) {
          labels.set(ref, label);
        }
      }

      for (const { runId, state } of following) {
        const work = known.get(runId);
        const followed = found.find((each) => each.runId.equals(state.runId));

        if (work) {
          states.set(
            runId,
            TitleAudience.following(
              state,
              audienceOf(work),
              followed ? audienceOf(followed) : null,
            ),
          );
        }
      }
    }

    const gates = [...states.values()].flatMap((state) =>
      state.status === 'decided' ? [state.gate] : [],
    );
    const gatedRuns = new Map(
      gates.flatMap((gate) => {
        const run = gate.by === 'run' ? known.get(gate.runId.value) : null;
        return run ? [[run.runId.value, run] as const] : [];
      }),
    );
    const [readable, members] = await Promise.all([
      this.viewers.readableAmong([...gatedRuns.values()], viewer),
      this.membersAmong(
        workspace,
        gates.flatMap((gate) => (gate.by === 'team' ? [gate.teamId] : [])),
        viewer,
      ),
    ]);
    const reads = (state: TitleAudienceState): boolean =>
      state.status === 'decided' &&
      ((state.gate.by === 'run' && readable.has(state.gate.runId.value)) ||
        (state.gate.by === 'team' && members.has(state.gate.teamId.value)));

    return new Map(
      runs.map((run) => {
        const state = states.get(run.runId.value);
        const label = labelOf(run);
        const shown = state ? TitleAudience.shown(state, reads(state)) : null;

        if (!label || !shown || shown.shows === 'nothing') {
          return [run.runId.value, UNNAMED_RUN] as const;
        }

        return [
          run.runId.value,
          shown.shows === 'title'
            ? {
                title: label.title,
                hiddenReason: null,
                link: shown.opens,
              }
            : {
                title: null,
                hiddenReason: shown.hidden ?? TEAM_HIDDEN_TITLE,
                link: null,
              },
        ] as const;
      }),
    );
  }

  /** The teams among these whose members the viewer is one of, from one read of the workspace's teams. */
  private async membersAmong(
    workspace: TitledWorkspace,
    teams: readonly TeamId[],
    viewer: UserId,
  ): Promise<ReadonlySet<string>> {
    if (teams.length === 0) {
      return new Set();
    }

    const access = await this.access.teamAccessIn(workspace.slug, viewer);
    const gated = new Set(teams.map((each) => each.value));

    return new Set(
      access && access.workspaceId.equals(workspace.workspaceId)
        ? access.teams.flatMap((each) =>
            each.actsOn && gated.has(each.teamId.value)
              ? [each.teamId.value]
              : [],
          )
        : [],
    );
  }
}
