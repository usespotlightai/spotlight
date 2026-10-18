import type { EgressConnectionRecord } from '@work/application/dto/egress-connections.dto';

export class FetchRunSecretsCommand {
  constructor(
    readonly token: string | undefined,
    readonly recipient: string,
  ) {}
}

export class AuthorizeRunnerCommand {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredential: string,
  ) {}
}

export class FetchSharedRunSecretsCommand {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredential: string,
    readonly recipient: string,
  ) {}
}

export class CheckActiveRunsCommand {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredentials: readonly string[],
  ) {}
}

export class RecordEgressConnectionsCommand {
  constructor(
    readonly token: string | undefined,
    readonly records: readonly EgressConnectionRecord[],
  ) {}
}
