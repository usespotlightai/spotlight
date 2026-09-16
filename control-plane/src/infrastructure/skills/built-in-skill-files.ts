import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SKILL_FILE } from '@application/contracts/configuration-layout.contract';
import type { BuiltInSkillsPort } from '@application/ports/built-in-skills.port';
import type {
  SkillFile,
  SkillFolder,
} from '@application/ports/skill-reader.port';
import { BUILT_IN_SKILL_KEYS } from '@domain/services/built-in-skills';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import { readSkillFolder } from '@infrastructure/skills/skill-file';

const SHIPPED_SKILLS = join(__dirname, 'built-in');

const filesIn = (root: string, within = ''): SkillFile[] =>
  readdirSync(join(root, within), { withFileTypes: true }).flatMap((each) => {
    const path = within ? `${within}/${each.name}` : each.name;

    return each.isDirectory()
      ? filesIn(root, path)
      : [{ path, text: readFileSync(join(root, path), 'utf8') }];
  });

export class BuiltInSkillFiles implements BuiltInSkillsPort {
  private readonly held: ReadonlyMap<string, SkillFolder>;

  constructor(directory: string = SHIPPED_SKILLS) {
    const folders = readdirSync(directory, { withFileTypes: true })
      .filter((each) => each.isDirectory())
      .map((each) =>
        readSkillFolder(
          each.name,
          filesIn(join(directory, each.name)),
          'shipped',
        ),
      );

    for (const key of BUILT_IN_SKILL_KEYS) {
      if (!folders.some((each) => each.skill.key.equals(key))) {
        throw new Error(
          `Spotlight ships a ${key.value} skill, and there is no ${key.value}/${SKILL_FILE} in ${directory}`,
        );
      }
    }

    this.held = new Map(folders.map((each) => [each.skill.key.value, each]));
  }

  named(key: SkillKey): SkillFolder | null {
    return this.held.get(key.value) ?? null;
  }
}
