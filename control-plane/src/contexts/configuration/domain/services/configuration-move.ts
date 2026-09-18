import type { ConfigurationHome } from '@configuration/domain/aggregates/configuration-home.aggregate';
import type { TeamConfiguration } from '@configuration/domain/aggregates/team-configuration.aggregate';
import type { ConfigurationFile } from '@shared-kernel/domain/value-objects/configuration-file.vo';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';

export type ConfigurationMove =
  | {
      readonly kind: 'carried';
      readonly home: ConfigurationHome;
      readonly files: readonly ConfigurationFile[];
    }
  | { readonly kind: 'adopted'; readonly home: ConfigurationHome }
  | { readonly kind: 'repointed'; readonly home: ConfigurationHome };

export const moveConfiguration = (input: {
  readonly home: ConfigurationHome;
  readonly current: TeamConfiguration | null;
  readonly destination: Repository;
  readonly destinationHolds: boolean;
}): ConfigurationMove => {
  const moving = input.home.movesTo(
    input.destination,
    input.current?.repository ?? null,
  );

  if (input.destinationHolds) {
    return { kind: 'adopted', home: moving.finishesMoving() };
  }

  const files = input.current?.files ?? [];

  if (files.length === 0) {
    return { kind: 'repointed', home: moving.finishesMoving() };
  }

  return { kind: 'carried', home: moving, files };
};

export const landConfigurationMove = (
  home: ConfigurationHome,
  destinationHolds: boolean,
): ConfigurationHome =>
  home.movingTo && destinationHolds ? home.finishesMoving() : home;
