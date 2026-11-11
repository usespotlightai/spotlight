import { SkillMainFileMissingError } from '@configuration/domain/exceptions/skill-main-file-missing.error';
import type { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export const SKILL_MAIN_FILE = 'SKILL.md';

export const skillFileProblem = (path: string): string | null => {
  if (path.length === 0) {
    return 'must not be empty';
  }

  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) {
    return 'must be a relative path in the skill folder, as in scripts/query.sh';
  }

  if (path.split('/').some((each) => ['', '.', '..'].includes(each))) {
    return 'must not have empty, . or .. parts';
  }

  return null;
};

export class SkillFiles {
  private readonly kind = 'skill-files';

  private constructor(private readonly byPath: ReadonlyMap<string, string>) {}

  static of(files: Readonly<Record<string, string>>): SkillFiles {
    for (const path of Object.keys(files)) {
      const problem = skillFileProblem(path);

      if (problem) {
        throw new InvalidIdentifierError('skill file', problem);
      }
    }

    return new SkillFiles(
      new Map(
        Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    );
  }

  guardMainFileOf(skill: DefinedSkillKey): void {
    if (!this.byPath.has(SKILL_MAIN_FILE)) {
      throw new SkillMainFileMissingError(skill.value, SKILL_MAIN_FILE);
    }
  }

  get entries(): readonly { readonly path: string; readonly text: string }[] {
    return [...this.byPath].map(([path, text]) => ({ path, text }));
  }

  get fields(): Readonly<Record<string, string>> {
    return Object.fromEntries(this.byPath);
  }

  equals(other: SkillFiles): boolean {
    return (
      this.kind === other.kind &&
      JSON.stringify([...this.byPath]) === JSON.stringify([...other.byPath])
    );
  }
}
