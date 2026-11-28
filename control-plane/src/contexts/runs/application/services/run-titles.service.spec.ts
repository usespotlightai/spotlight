import type {
  TeamPermissions,
  WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { RunPolicyContract } from '@runs/application/contracts/run-order.contract';
import {
  type RequesterLabel,
  requesterRefOf,
} from '@runs/application/ports/run-requester-labels.port';
import type {
  ActivityRunRow,
  RunnerActivityReaderPort,
} from '@runs/application/ports/runner-activity-reader.port';
import { RunRequesterLabels } from '@runs/application/services/run-requester-labels.service';
import { RunTitles } from '@runs/application/services/run-titles.service';
import type { RunViewing } from '@runs/application/services/run-viewing.service';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const WORKSPACE = WorkspaceId.of('ws_1');
const VIEWER = UserId.of('user_1');

const POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
};

const runOf = (
  runId: string,
  requester: { owner: string; kind: string; id: string },
  {
    listed = false,
    teamId = 'team_1',
  }: { listed?: boolean; teamId?: string | null } = {},
): ActivityRunRow => ({
  runId: RunId.of(runId),
  state: 'claimed',
  workspaceId: WORKSPACE,
  requester: { ...requester, token: null, team: teamId },
  policy: { ...POLICY, listed },
  teamId,
});

const TASK_RUN = runOf(
  'run_task',
  { owner: 'work', kind: 'task', id: 'task_1' },
  { listed: true },
);
const CHAT_RUN = runOf(
  'run_chat',
  { owner: 'work', kind: 'chat', id: 'chat_1' },
  { listed: true },
);
const REPLAY_RUN = runOf('run_replay', {
  owner: 'replays',
  kind: 'replay',
  id: 'run_replay',
});
const sessionRunOf = (id: string) =>
  runOf(`run_${id}`, { owner: 'assist', kind: 'session', id });

const JUDGING = sessionRunOf('judging');
const JUDGING_REPLAY = sessionRunOf('judging_replay');
const ON_CHAT = sessionRunOf('on_chat');
const ON_GONE = sessionRunOf('on_gone');
const SEARCH = runOf('run_search', {
  owner: 'replays',
  kind: 'search',
  id: 'search_1',
});
const SESSION_ON_SESSION = sessionRunOf('on_session');
const SESSION_ON_LOOP = sessionRunOf('on_loop');
const NO_TEAM_ON_GONE = runOf(
  'run_no_team',
  { owner: 'assist', kind: 'session', id: 'no_team' },
  { teamId: null },
);
const UNLISTED_OWN = runOf('run_unlisted', {
  owner: 'work',
  kind: 'task',
  id: 'task_unlisted',
});
const UNNAMED = runOf('run_other', {
  owner: 'elsewhere',
  kind: 'job',
  id: 'x',
});

const TASK_HIDDEN = 'Title hidden. This run belongs to a team you’re not on.';
const CHAT_HIDDEN =
  'Title hidden. Only the person who started the agent chat sees it.';

const sessionLabel = (title: string, runId: string): RequesterLabel => ({
  title,
  readers: { of: 'run', runId: RunId.of(runId), opens: true },
});

const LABELS: Record<string, RequesterLabel | undefined> = {
  [requesterRefOf(TASK_RUN.requester)]: {
    title: 'Incident owners 2/5',
    readers: { of: 'the-run', opens: true, hidden: TASK_HIDDEN },
  },
  [requesterRefOf(CHAT_RUN.requester)]: {
    title: 'Plan the migration',
    readers: { of: 'the-run', opens: false, hidden: CHAT_HIDDEN },
  },
  [requesterRefOf(REPLAY_RUN.requester)]: {
    title: 'A replay run',
    readers: { of: 'team-members', teamId: TeamId.of('team_1') },
  },
  [requesterRefOf(SEARCH.requester)]: {
    title: 'A search run',
    readers: { of: 'team-members', teamId: TeamId.of('team_other') },
  },
  [requesterRefOf(JUDGING.requester)]: sessionLabel(
    'Judging Implementation on “Incident owners 2/5”',
    'run_task',
  ),
  [requesterRefOf(JUDGING_REPLAY.requester)]: sessionLabel(
    'Judging Implementation on “Incident owners 2/5”',
    'run_replay',
  ),
  [requesterRefOf(ON_CHAT.requester)]: sessionLabel(
    'Building the change stack for “Plan the migration”',
    'run_chat',
  ),
  [requesterRefOf(ON_GONE.requester)]: sessionLabel(
    'Checking proposed memories',
    'run_gone',
  ),
  [requesterRefOf(NO_TEAM_ON_GONE.requester)]: sessionLabel(
    'Checking proposed memories',
    'run_gone',
  ),
  [requesterRefOf(UNLISTED_OWN.requester)]: {
    title: 'Never shown',
    readers: { of: 'the-run', opens: true, hidden: TASK_HIDDEN },
  },
  [requesterRefOf(SESSION_ON_SESSION.requester)]: sessionLabel(
    'Judging the judge',
    'run_judging',
  ),
  [requesterRefOf(SESSION_ON_LOOP.requester)]: sessionLabel(
    'Going round',
    'run_on_loop',
  ),
};

const titling = ({
  readable,
  teams,
}: {
  readable: readonly string[];
  teams: readonly string[];
}) => {
  const labels = new RunRequesterLabels();

  for (const owner of ['work', 'assist', 'replays']) {
    labels.register({
      owner,
      labelsOf: async (requesters) =>
        new Map(
          requesters.flatMap((each) => {
            const label = LABELS[requesterRefOf(each)];
            return label ? [[requesterRefOf(each), label] as const] : [];
          }),
        ),
    });
  }

  const readableAmong = vi.fn(
    async (runs: readonly { runId: RunId }[]) =>
      new Set(
        runs
          .map((each) => each.runId.value)
          .filter((each) => readable.includes(each)),
      ),
  );
  const runsOf = vi.fn(async (_workspace: unknown, ids: readonly RunId[]) =>
    [TASK_RUN, CHAT_RUN, REPLAY_RUN, JUDGING, SESSION_ON_LOOP].filter((each) =>
      ids.some((id) => id.equals(each.runId)),
    ),
  );
  const permissionsAsTeamMember = vi.fn(async (teamId: TeamId) =>
    teams.includes(teamId.value) ? partial<TeamPermissions>({ teamId }) : null,
  );

  return {
    titles: new RunTitles(
      labels,
      partial<RunViewing>({ readableAmong }),
      partial<RunnerActivityReaderPort>({ runsOf }),
      partial<WorkspaceAccessPort>({ permissionsAsTeamMember }),
    ),
    runsOf,
  };
};

const UNNAMED_TITLE = {
  title: 'A run',
  hidden: null,
  opens: null,
};

describe('RunTitles', () => {
  it('titles work for a task run to whoever reads that run, opening it', async () => {
    const { titles, runsOf } = titling({ readable: ['run_task'], teams: [] });

    const titled = await titles.of(WORKSPACE, [JUDGING, TASK_RUN], VIEWER);

    expect(titled.get('run_judging')).toEqual({
      title: 'Judging Implementation on “Incident owners 2/5”',
      hidden: null,
      opens: { runId: 'run_task', teamId: 'team_1' },
    });
    expect(titled.get('run_task')).toEqual({
      title: 'Incident owners 2/5',
      hidden: null,
      opens: { runId: 'run_task', teamId: 'team_1' },
    });
    expect(runsOf).toHaveBeenCalledTimes(1);
  });

  it('titles a replay run to the members of its team, opening no run', async () => {
    const { titles } = titling({ readable: [], teams: ['team_1'] });

    expect(
      (await titles.of(WORKSPACE, [REPLAY_RUN], VIEWER)).get('run_replay'),
    ).toEqual({
      title: 'A replay run',
      hidden: null,
      opens: null,
    });
  });

  it('hides the title of another team’s run from a viewer on a different team', async () => {
    const { titles } = titling({ readable: [], teams: ['team_1'] });

    const titled = await titles.of(WORKSPACE, [REPLAY_RUN, SEARCH], VIEWER);

    expect(titled.get('run_replay')?.title).toBe('A replay run');
    expect(titled.get('run_search')).toEqual({
      title: null,
      hidden: TASK_HIDDEN,
      opens: null,
    });
  });

  it('follows work for a replay run to the members of the replay’s team, opening no run', async () => {
    const { titles } = titling({ readable: [], teams: ['team_1'] });

    expect(
      (await titles.of(WORKSPACE, [JUDGING_REPLAY], VIEWER)).get(
        'run_judging_replay',
      ),
    ).toEqual({
      title: 'Judging Implementation on “Incident owners 2/5”',
      hidden: null,
      opens: null,
    });
  });

  it('hides the title from a viewer who may not read the run it is for, saying whose it is', async () => {
    const { titles } = titling({ readable: [], teams: [] });

    const titled = await titles.of(
      WORKSPACE,
      [JUDGING, JUDGING_REPLAY, ON_CHAT, SEARCH],
      VIEWER,
    );

    expect(titled.get('run_judging')).toEqual({
      title: null,
      hidden: TASK_HIDDEN,
      opens: null,
    });
    expect(
      (await titles.of(WORKSPACE, [REPLAY_RUN], VIEWER)).get('run_replay'),
    ).toEqual({
      title: null,
      hidden: TASK_HIDDEN,
      opens: null,
    });
    expect(titled.get('run_judging_replay')?.hidden).toBe(TASK_HIDDEN);
    expect(titled.get('run_on_chat')?.hidden).toBe(CHAT_HIDDEN);
    expect(titled.get('run_search')?.hidden).toBe(TASK_HIDDEN);
  });

  it('titles work for a run that is gone to the members of the work’s team', async () => {
    const { titles } = titling({ readable: [], teams: ['team_1'] });

    expect(
      (await titles.of(WORKSPACE, [ON_GONE], VIEWER)).get('run_on_gone'),
    ).toEqual({
      title: 'Checking proposed memories',
      hidden: null,
      opens: null,
    });
  });

  it('opens a chat run its work is for only where the chat run’s own title would', async () => {
    const { titles } = titling({ readable: ['run_chat'], teams: [] });

    expect(
      (await titles.of(WORKSPACE, [ON_CHAT], VIEWER)).get('run_on_chat'),
    ).toEqual({
      title: 'Building the change stack for “Plan the migration”',
      hidden: null,
      opens: null,
    });
  });

  it('follows work for work for a run, and no further', async () => {
    const { titles } = titling({ readable: ['run_task'], teams: [] });

    const titled = await titles.of(
      WORKSPACE,
      [SESSION_ON_SESSION, SESSION_ON_LOOP],
      VIEWER,
    );

    expect(titled.get('run_on_session')).toEqual({
      title: 'Judging the judge',
      hidden: null,
      opens: { runId: 'run_task', teamId: 'team_1' },
    });
    expect(titled.get('run_on_loop')).toEqual(UNNAMED_TITLE);
  });

  it('never shows the title of an unlisted run to the readers of the run itself, whoever reads it', async () => {
    const { titles } = titling({
      readable: ['run_unlisted'],
      teams: ['team_1'],
    });

    expect(
      (await titles.of(WORKSPACE, [UNLISTED_OWN], VIEWER)).get('run_unlisted'),
    ).toEqual(UNNAMED_TITLE);
  });

  it('names plainly, and hides nothing of, a run that no one may read or no context names', async () => {
    const { titles } = titling({ readable: [], teams: [] });

    const titled = await titles.of(
      WORKSPACE,
      [UNNAMED, NO_TEAM_ON_GONE],
      VIEWER,
    );

    expect(titled.get('run_other')).toEqual(UNNAMED_TITLE);
    expect(titled.get('run_no_team')).toEqual(UNNAMED_TITLE);
  });
});
