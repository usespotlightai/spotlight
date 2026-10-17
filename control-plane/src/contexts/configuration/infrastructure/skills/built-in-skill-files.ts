import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ShippedSkillsPort } from '@configuration/application/ports/shipped-skills.port';
import type {
  SkillFile,
  SkillFolder,
} from '@configuration/application/ports/skill-reader.port';
import { readSkillFolder } from '@configuration/infrastructure/skills/skill-file';
import { SKILL_FILE } from '@work/application/contracts/run-spec.contract';

const SHIPPED_SKILLS = join(__dirname, 'built-in');

const filesIn = (root: string, within = ''): SkillFile[] =>
  readdirSync(join(root, within), { withFileTypes: true }).flatMap((each) => {
    const path = within ? `${within}/${each.name}` : each.name;

    return each.isDirectory()
      ? filesIn(root, path)
      : [{ path, text: readFileSync(join(root, path), 'utf8') }];
  });

export class BuiltInSkillFiles implements ShippedSkillsPort {
  private readonly byKey: ReadonlyMap<string, SkillFolder>;

  constructor(keys: readonly string[], directory: string = SHIPPED_SKILLS) {
    const folders = readdirSync(directory, { withFileTypes: true })
      .filter((each) => each.isDirectory())
      .map((each) =>
        readSkillFolder(
          each.name,
          filesIn(join(directory, each.name)),
          'shipped',
        ),
      );

    for (const key of keys) {
      if (!folders.some((each) => each.skill.key.value === key)) {
        throw new Error(
          `Spotlight ships a ${key} skill, and there is no ${key}/${SKILL_FILE} in ${directory}`,
        );
      }
    }

    this.byKey = new Map(folders.map((each) => [each.skill.key.value, each]));
  }

  named(key: string): SkillFolder | null {
    return this.byKey.get(key) ?? null;
  }
}
