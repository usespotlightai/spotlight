import {
  type StationUse,
  StationUses,
  type UsedKey,
} from '@configuration/domain/value-objects/station-uses.vo';
import type {
  EnabledAtStation,
  EnabledAtStationsPort,
} from '@lines/application/ports/enabled-at-stations.port';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

const usesOf = <K extends UsedKey<K>>(
  enabled: readonly EnabledAtStation[],
  keyOf: (raw: string) => K,
): StationUses<K> =>
  StationUses.of<K>(
    enabled.flatMap((each): StationUse<K>[] => {
      try {
        return [
          {
            used: keyOf(each.name),
            line: LineKey.of(each.line),
            station: StationKey.of(each.station),
          },
        ];
      } catch (error) {
        if (error instanceof InvalidIdentifierError) {
          return [];
        }

        throw error;
      }
    }),
  );

export class StationReferences {
  constructor(private readonly enabledAtStations: EnabledAtStationsPort) {}

  async skillsOn(teamId: TeamId): Promise<StationUses<SkillKey>> {
    return usesOf(
      await this.enabledAtStations.onTeam(teamId, 'skill'),
      SkillKey.of,
    );
  }

  async profilesOn(teamId: TeamId): Promise<StationUses<ProfileKey>> {
    return usesOf(
      await this.enabledAtStations.onTeam(teamId, 'profile'),
      ProfileKey.of,
    );
  }
}
