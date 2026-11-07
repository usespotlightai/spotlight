import type { EgressConnectionRecord } from '@runs/application/dto/egress-connections.dto';

export class FetchRunSecretsCommand {
  constructor(
    readonly token: string | undefined,
    readonly recipient: string,
  ) {}
}

export class FetchSharedRunSecretsCommand {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredential: string,
    readonly recipient: string,
  ) {}
}

export class RecordEgressConnectionsCommand {
  constructor(
    readonly token: string | undefined,
    readonly records: readonly EgressConnectionRecord[],
  ) {}
}
