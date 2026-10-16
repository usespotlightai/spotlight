import { api, json, notFound } from '@/mocks/http';
import { scenario } from '@/mocks/scenario';
import { world } from '@/mocks/world';
import { settingsWorld } from '@/mocks/world/settings';

const workspaceAs = () => ({
  ...world().workspace,
  provisioning: settingsWorld().settingUp.includes(world().workspace.id)
    ? ('pending' as const)
    : ('done' as const),
  role:
    scenario().account === 'member'
      ? ('member' as const)
      : world().workspace.role,
});

import { runsOfAnyTask } from '@/mocks/world/run-stories';

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

  api.get('/teams/:teamId/tasks', ({ params }) =>
    json(world().tasks[String(params.teamId)] ?? []),
  ),

  api.get('/teams/:teamId/tasks/:taskId/runs', ({ params }) =>
    json(runsOfAnyTask(String(params.taskId))),
  ),
];
