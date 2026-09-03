import type { SecretName } from '@domain/value-objects/secret-name.vo';
import type { TeamId } from '@domain/value-objects/team-id.vo';

export const TEAM_SECRETS = Symbol('TEAM_SECRETS');

/** A secret as anybody is ever shown it: its name, and when it was last set. */
export interface SecretSummary {
  readonly name: string;
  readonly setAt: Date;
}

/**
 * What a team's configuration is allowed to know but not to hold. A secret is
 * written once from the outside and read only here, so what sits in a
 * repository is the name of a thing rather than the thing.
 *
 * Nothing gives a secret back to a person. Setting it again is how it changes,
 * and that is the only way its value moves in any direction but inward.
 */
export interface TeamSecretsPort {
  set(teamId: TeamId, name: SecretName, value: string): Promise<void>;

  /** Read where a source needs one. Null where the workspace has set none. */
  resolve(teamId: TeamId, name: SecretName): Promise<string | null>;

  /** What a person may see: names, never values. */
  held(teamId: TeamId): Promise<readonly SecretSummary[]>;

  forget(teamId: TeamId, name: SecretName): Promise<void>;
}
