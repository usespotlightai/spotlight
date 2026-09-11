import type { Team } from '@domain/aggregates/team.aggregate';
import type { TeamConfiguration } from '@domain/aggregates/team-configuration.aggregate';
import type { ConfigurationFile } from '@domain/value-objects/configuration-file.vo';
import type { Repository } from '@domain/value-objects/repository.vo';

export type ConfigurationMove =
  | {
      readonly kind: 'carried';
      readonly team: Team;
      readonly files: readonly ConfigurationFile[];
    }
  /** Somebody's own configuration is read as it is, never written over. */
  | { readonly kind: 'adopted'; readonly team: Team }
  | { readonly kind: 'repointed'; readonly team: Team };

/**
 * What is carried is what the team kept at its last reading, since that is
 * what it runs on today.
 */
export const moveConfiguration = (input: {
  readonly team: Team;
  readonly current: TeamConfiguration | null;
  readonly destination: Repository;
  readonly destinationHolds: boolean;
}): ConfigurationMove => {
  const moving = input.team.movesConfigurationTo(
    input.destination,
    input.current?.repository ?? null,
  );

  if (input.destinationHolds) {
    return { kind: 'adopted', team: moving.finishesMovingConfiguration() };
  }

  const files = input.current?.kept ?? [];

  if (files.length === 0) {
    return { kind: 'repointed', team: moving.finishesMovingConfiguration() };
  }

  return { kind: 'carried', team: moving, files };
};

/**
 * A move under way lands once the repository it is going to holds
 * configuration of its own, which is the pull request carrying it merging.
 * Until then the team comes back exactly as it was given.
 */
export const landConfigurationMove = (
  team: Team,
  destinationHolds: boolean,
): Team =>
  team.movingConfigurationTo && destinationHolds
    ? team.finishesMovingConfiguration()
    : team;
