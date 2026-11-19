export const TASK_CHANGES_ROUTE = 'tasks/:taskId/changes';

export const RUN_CHANGES_ROUTE = 'runs/:runId/changes';

const TEAM_URL = '/w/:slug/team/:teamId';

export const TASK_CHANGES_URL = `${TEAM_URL}/${TASK_CHANGES_ROUTE}`;

export const RUN_CHANGES_URL = `${TEAM_URL}/${RUN_CHANGES_ROUTE}`;
