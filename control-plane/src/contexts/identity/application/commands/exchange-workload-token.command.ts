import type { Client } from '@shared-kernel/domain/value-objects/client.vo';

export class ExchangeWorkloadTokenCommand {
  constructor(
    readonly trustId: string,
    readonly workloadToken: string,
    readonly client: Client,
  ) {}
}
