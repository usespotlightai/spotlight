import type {
  HookEventInstance,
  HookRuntimePort,
  ListeningHook,
} from '@integrations/application/ports/hook-runtime.port';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export const hookMatches = (
  runtime: HookRuntimePort,
  hook: ListeningHook,
  instance: HookEventInstance,
): boolean =>
  (hook.written?.matches(
    {
      line: LineKey.of(instance.task.line),
      stationKey: instance.task.stationKey,
      repositories: instance.task.repositories.map(Repository.of),
    },
    instance.event,
  ) ??
    false) &&
  runtime.whenHolds(hook, instance);
