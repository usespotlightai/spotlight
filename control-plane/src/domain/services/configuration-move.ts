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
  | { readonly kind: 'adopted'; readonly team: Team }
  | { readonly kind: 'repointed'; readonly team: Team };

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

  const files = input.current?.files ?? [];

  if (files.length === 0) {
    return { kind: 'repointed', team: moving.finishesMovingConfiguration() };
  }

  return { kind: 'carried', team: moving, files };
};

export const landConfigurationMove = (
  team: Team,
  destinationHolds: boolean,
): Team =>
  team.movingConfigurationTo && destinationHolds
    ? team.finishesMovingConfiguration()
    : team;
