export class ScopesExceedCallerError extends Error {
  constructor(key: string) {
    super(`OIDC trust ${key} grants scopes your token does not have.`);
    this.name = 'ScopesExceedCallerError';
  }
}
