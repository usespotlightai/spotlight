import type {
  ReadSkillFolder,
  TeamSkillFoldersPort,
} from '@configuration/application/ports/skill-folders.port';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import type { SkillFolderReading } from '@configuration/domain/services/skill-folder-reading';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class TeamSkillReading {
  constructor(
    private readonly folders: TeamSkillFoldersPort,
    private readonly reading: SkillFolderReading,
  ) {}

  async of(teamId: TeamId): Promise<readonly ReadSkillFolder[]> {
    return (await this.folders.of(teamId)).map((folder) => {
      try {
        return {
          skill: this.reading.skillIn(folder.key, folder.files),
          files: folder.files.entries,
        };
      } catch (error) {
        if (error instanceof InvalidSkillError) {
          throw new InconsistentStateError(
            'skill',
            `${folder.key.value} was stored in a shape that no longer reads (${error.because})`,
          );
        }

        throw error;
      }
    });
  }
}
