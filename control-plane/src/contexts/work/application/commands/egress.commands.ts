import type { EgressConnectionRecord } from '@work/application/dto/egress-connections.dto';

export class RedeemEgressCommand {
  constructor(
    readonly token: string | undefined,
    readonly recipient: string,
  ) {}
}

export class AdmitThroughEgressCommand {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredential: string,
  ) {}
}

export class RedeemThroughEgressCommand {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredential: string,
    readonly recipient: string,
  ) {}
}

export class KeepEgressHoldsCommand {
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
