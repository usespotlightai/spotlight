import type { TeamSkillFoldersPort } from '@configuration/application/ports/skill-folders.port';
import { TeamSkillReading } from '@configuration/application/services/team-skill-reading.service';
import { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import { SkillCompiler } from '@configuration/infrastructure/skills/skill.compile';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');

const stored = (files: Readonly<Record<string, string>>) =>
  new TeamSkillReading(
    {
      of: async () => [
        { key: DefinedSkillKey.of('grafana'), files: SkillFiles.of(files) },
      ],
    } satisfies TeamSkillFoldersPort,
    new SkillCompiler(),
  );

describe('TeamSkillReading', () => {
  it('reads each stored skill from its own files, the way it was saved', async () => {
    const [folder] = await stored({
      'SKILL.md':
        '---\nname: grafana\ndescription: Look up dashboards\n---\nSearch first.',
      'queries/p99.promql': 'rate(x[5m])',
    }).of(TEAM);

    expect(folder?.skill.description).toBe('Look up dashboards');
    expect(folder?.files.map((each) => each.path)).toEqual([
      'SKILL.md',
      'queries/p99.promql',
    ]);
  });

  it('fails loudly on a stored skill that no longer reads', async () => {
    await expect(stored({ 'README.md': 'hello' }).of(TEAM)).rejects.toThrow(
      InconsistentStateError,
    );
  });
});
