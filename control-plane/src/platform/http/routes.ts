export const API_PREFIX = 'api';

export const RESOURCE_API = 'v1';

export const RESOURCES = `${RESOURCE_API}/resources`;

export const EXPRESSIONS = `${RESOURCE_API}/expressions`;

export const WORKSPACE_TOKEN_EXCHANGE = `${RESOURCE_API}/workspace-tokens`;

export const WEBHOOKS = 'webhooks';

export const TERRAFORM_STATE_ROUTE = 'terraform/workspaces/:slug/states/:name';

export const TEAM_DELIVERIES = 'w/:slug/t/:teamKey/:integration';
export const INTEGRATION_DELIVERIES = ':integration';

export const RUN_EVENTS = 'runs/:runId/events';
export const RUN_COMPLETION = 'runs/:runId/completion';
export const RUN_TOOL_CALL = 'runs/:runId/tools/:tool';
export const RUN_CHANGE_STACKS = 'runs/:runId/change-stacks';
export const RUN_CHANGE_STACK_CHECK =
  'runs/:runId/change-stack-checks/:stackId';
export const HOOK_CALLBACKS = 'hook-callbacks';

export const COLLAB = 'collab';

export const SANDBOX_CONNECT = 'sandboxes/connect';

export const EDITOR_CONNECTIONS = 'editor-connections';
