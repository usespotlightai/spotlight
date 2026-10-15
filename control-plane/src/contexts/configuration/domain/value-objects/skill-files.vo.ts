import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';

export const skillFileRefusal = (path: string): string | null => {
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

  private constructor(private readonly held: ReadonlyMap<string, string>) {}

  static of(files: Readonly<Record<string, string>>): SkillFiles {
    for (const path of Object.keys(files)) {
      const refused = skillFileRefusal(path);

      if (refused) {
        throw new InvalidIdentifierError('skill file', refused);
      }
    }

    return new SkillFiles(
      new Map(
        Object.entries(files).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    );
  }

  get entries(): readonly { readonly path: string; readonly text: string }[] {
    return [...this.held].map(([path, text]) => ({ path, text }));
  }

  get fields(): Readonly<Record<string, string>> {
    return Object.fromEntries(this.held);
  }

  equals(other: SkillFiles): boolean {
    return (
      this.kind === other.kind &&
      JSON.stringify([...this.held]) === JSON.stringify([...other.held])
    );
  }
}
