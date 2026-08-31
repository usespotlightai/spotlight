export const REPOSITORY_EVENTS = Symbol('REPOSITORY_EVENTS');

export interface MergedPullRequest {
  readonly url: string;
}

/**
 * The host speaks its own language: this is where it is read into Spotlight's.
 * A delivery that says nothing Spotlight acts on reads as nothing at all.
 */
export interface RepositoryEventsPort {
  merged(event: string | undefined, payload: unknown): MergedPullRequest | null;
}
