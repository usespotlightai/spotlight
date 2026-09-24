import type { ConfigurationChanged } from '@shared-kernel/domain/events/configuration-changed';
import type { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export class RunnerEnrolled implements ConfigurationChanged {
  readonly kind = 'runner.enrolled';

  constructor(
    readonly runnerId: RunnerId,
    readonly workspaceId: WorkspaceId,
    readonly change: ConfigurationChange,
  ) {}
}
