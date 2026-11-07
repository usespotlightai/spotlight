import type { HookRuntimePort } from '@integrations/application/ports/hook-runtime.port';
import type { HookEventName } from '@integrations/domain/value-objects/hook-event.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class HooksListening {
  constructor(private readonly runtime: HookRuntimePort) {}

  async on(teamId: TeamId, on: HookEventName): Promise<boolean> {
    return (await this.runtime.listening(teamId, on)).length > 0;
  }
}
