export const SECRET_READINESS = Symbol('SECRET_READINESS');

export interface SecretReadinessPort {
  awaitingValue(
    workspaceId: string,
    names: readonly string[],
  ): Promise<readonly string[]>;
}
