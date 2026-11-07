export const PROVISION_FAILED = 'provision.failed';

export const HOOK_CALLED = 'hook.called';

export const RUN_PAUSED = 'run.paused';

const CONTROL_PLANE_TYPES: ReadonlySet<string> = new Set([
  PROVISION_FAILED,
  HOOK_CALLED,
  RUN_PAUSED,
]);

export const isControlPlaneType = (type: string): boolean =>
  CONTROL_PLANE_TYPES.has(type);
