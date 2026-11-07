export class AuthorizeRunnerQuery {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredential: string,
  ) {}
}

export class ActiveRunsQuery {
  constructor(
    readonly token: string | undefined,
    readonly proxyCredentials: readonly string[],
  ) {}
}
