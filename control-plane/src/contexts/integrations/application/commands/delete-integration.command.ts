import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

export class DeleteIntegrationCommand {
  constructor(
    readonly integrationId: string,
    readonly actor: Actor,
    readonly expectedVersion: number,
  ) {}
}
