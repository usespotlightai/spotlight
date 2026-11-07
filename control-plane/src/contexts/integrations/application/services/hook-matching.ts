import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
} from '@integrations/application/ports/hook-runtime.port';

export const hookMatches = (
  runtime: HookRuntimePort,
  hook: ListeningHook,
  instance: HookEventInstance,
): boolean =>
  (hook.written?.matches(
    {
      line: instance.task.line,
      stationKey: instance.task.stationKey.value,
      repositories: instance.task.repositories,
    },
    instance.event,
  ) ??
    false) &&
  runtime.whenHolds(hook, instance);
