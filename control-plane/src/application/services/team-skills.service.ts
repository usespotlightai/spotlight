import type {
  SkillFolder,
  SkillReaderPort,
} from '@application/ports/skill-reader.port';
import type { TeamSecretsPort } from '@application/ports/team-secrets.port';
import type { Line } from '@domain/aggregates/line.aggregate';
import type { Station } from '@domain/entities/station.entity';
import type { FactoryRepository } from '@domain/repositories/factory.repository';
import type { TeamConfigurationRepository } from '@domain/repositories/team-configuration.repository';

export class TeamSkills {
  constructor(
    private readonly factories: FactoryRepository,
    private readonly configurations: TeamConfigurationRepository,
    private readonly reader: SkillReaderPort,
    private readonly secrets: TeamSecretsPort,
  ) {}

  async readyAt(line: Line, station: Station): Promise<readonly SkillFolder[]> {
    if (station.skills.length === 0) {
      return [];
    }

    const factory = await this.factories.find(line.factoryId);
    const applied = factory
      ? await this.configurations.findFor(factory.teamId)
      : null;

    if (!factory || !applied) {
      return [];
    }

    const named = this.reader
      .read(applied.files)
      .skills.filter((folder) =>
        station.skills.some((key) => key.equals(folder.skill.key)),
      );
    const held = named.some((folder) => folder.skill.secrets.length > 0)
      ? await this.secrets.held(factory.teamId)
      : [];

    return named.filter((folder) => folder.skill.isReadyWith(held));
  }
}
