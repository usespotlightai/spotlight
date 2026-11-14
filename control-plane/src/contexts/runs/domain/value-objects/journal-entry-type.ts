export const TOOL_REFUSED = 'tool.refused';

export const EGRESS_CHECKED = 'egress.checked';

export const AGENT_STOPPED = 'agent.stopped';

export const PROVISION_FAILED = 'provision.failed';

export const HOOK_CALLED = 'hook.called';

export const RUN_PAUSED = 'run.paused';

export const HARNESS_CONNECTED = 'harness.connected';

export const AGENT_REMINDED = 'agent.reminded';

export const BACKGROUND_WAITING = 'background.waiting';

export const BACKGROUND_SETTLED = 'background.settled';

export const BACKGROUND_LOST = 'background.lost';

const CONTROL_PLANE_TYPES: ReadonlySet<string> = new Set([
  PROVISION_FAILED,
  HOOK_CALLED,
  RUN_PAUSED,
]);

export const isControlPlaneType = (type: string): boolean =>
  CONTROL_PLANE_TYPES.has(type);
