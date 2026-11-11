import { api, json, notFound } from '@/mocks/http';
import { pageOf } from '@/mocks/paging';
import { scenario } from '@/mocks/scenario';
import { world } from '@/mocks/world';
import { avatars, WORKSPACE_AVATAR } from '@/mocks/world/avatars';
import { runsOfAnyTask } from '@/mocks/world/run-stories';
import { settingsWorld } from '@/mocks/world/settings';

const workspaceAs = () => ({
  ...world().workspace,
  avatarUrl: avatars().get(WORKSPACE_AVATAR) ?? world().workspace.avatarUrl,
  teams: world().workspace.teams.map((team) => ({
    ...team,
    avatarUrl: avatars().get(team.id) ?? team.avatarUrl,
  })),
  setupStatus: settingsWorld().settingUp.includes(world().workspace.id)
    ? ('pending' as const)
    : ('done' as const),
  role:
    scenario().account === 'member'
      ? ('member' as const)
      : world().workspace.role,
});

const completedStationsOf = (teamId: string, lineId: string | null) =>
  new Set(
    (world().lines[teamId] ?? [])
      .filter((line) => !lineId || line.id === lineId)
      .flatMap((line) => line.stations)
      .filter((station) => station.kind === 'completed')
      .map((station) => station.id),
  );

export const shellHandlers = [
  api.get('/workspaces', () =>
    json(scenario().account === 'no-workspace' ? [] : [workspaceAs()]),
  ),

  api.get('/workspaces/:slug', ({ params }) =>
    params.slug === world().workspace.slug &&
    scenario().account !== 'no-workspace'
      ? json(workspaceAs())
      : notFound(),
  ),

  api.get('/teams/:teamId/lines', ({ params }) => {
    const lines = world().lines[String(params.teamId)];
    return lines ? json(lines) : notFound();
  }),

  api.get('/teams/:teamId/members', ({ params }) =>
    json(world().members[String(params.teamId)] ?? []),
  ),

  api.get('/teams/:teamId/tasks', ({ params, request }) => {
    const teamId = String(params.teamId);
    const query = new URL(request.url).searchParams;
    const lineId = query.get('lineId');
    const completed = completedStationsOf(teamId, lineId);
    const tasks = world().tasks[teamId] ?? [];

    return json(
      query.get('state') === 'completed-station'
        ? pageOf(
            tasks.filter((task) => completed.has(task.stationId)),
            request,
            (task) => task.id,
          )
        : {
            items: tasks.filter(
              (task) => !completedStationsOf(teamId, null).has(task.stationId),
            ),
            next: null,
          },
    );
  }),

  api.get('/teams/:teamId/tasks/:taskId', ({ params }) => {
    const task = world().tasks[String(params.teamId)]?.find(
      (each) => each.id === String(params.taskId),
    );
    return task ? json(task) : notFound();
  }),

  api.get('/teams/:teamId/tasks/:taskId/runs', ({ params }) =>
    json(runsOfAnyTask(String(params.taskId))),
  ),
];
