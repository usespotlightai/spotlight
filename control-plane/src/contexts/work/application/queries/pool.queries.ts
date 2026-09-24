export class PoolQueueQuery {
  constructor(
    readonly token: string | undefined,
    readonly poolId: string,
  ) {}
}

export class PoolHarnessesQuery {
  constructor(readonly token: string | undefined) {}
}
