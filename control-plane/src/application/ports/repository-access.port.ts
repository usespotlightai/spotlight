export interface RepositoryCredential {
  readonly username: string;
  readonly password: string;
}

export const REPOSITORY_ACCESS = Symbol('REPOSITORY_ACCESS');

/** Nothing this answers with is ever sent to a runner. */
export interface RepositoryAccessPort {
  credential(): Promise<RepositoryCredential>;
}
