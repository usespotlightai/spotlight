import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const SKILL = (front: string) =>
  `---\nname: grafana-dashboards\ndescription: Reading this team’s dashboards.\n${front}---\n\nDashboards are at https://grafana.acme.dev.\n`;

const readSkill = (folder: string, text: string) =>
  readSkillFolder(folder, [{ path: 'SKILL.md', text }], 'defined').skill;

describe('what a skill requires from a team', () => {
  it('reads the secrets its frontmatter lists, each with what it is for', () => {
    const skill = readSkill(
      'grafana-dashboards',
      SKILL('secrets:\n  GRAFANA_TOKEN: Read-only token its tools use\n'),
    );

    expect(skill.secrets).toEqual([
      {
        name: SecretName.of('GRAFANA_TOKEN'),
        description: 'Read-only token its tools use',
      },
    ]);
  });

  it('requires nothing where its frontmatter lists nothing', () => {
    const skill = readSkill('grafana-dashboards', SKILL(''));

    expect(skill.secrets).toEqual([]);
    expect(skill.tools).toEqual([]);
  });

  it('rejects secrets written as something other than names with what each is for', () => {
    expect(() =>
      readSkill('grafana-dashboards', SKILL('secrets:\n  - GRAFANA_TOKEN\n')),
    ).toThrow(InvalidSkillError);
  });

  it('rejects a name no secret could have', () => {
    expect(() =>
      readSkill('grafana-dashboards', SKILL('secrets:\n  grafana_token: x\n')),
    ).toThrow('must use capitals, digits and underscores');
  });

  it('reads the tools it brings, each named for its integration', () => {
    const skill = readSkill(
      'grafana-dashboards',
      SKILL('tools:\n  - grafana.search\n  - pull-request\n'),
    );

    expect(skill.tools.map((each) => each.value)).toEqual([
      'grafana.search',
      'pull-request',
    ]);
  });

  it('rejects tools written as something other than a list of tool names', () => {
    expect(() =>
      readSkill('grafana-dashboards', SKILL('tools: grafana.search\n')),
    ).toThrow('tools must be a list');
    expect(() =>
      readSkill('grafana-dashboards', SKILL('tools:\n  - Grafana Search\n')),
    ).toThrow('must be named integration.tool');
  });
});
