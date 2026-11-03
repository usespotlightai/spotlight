import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { InvalidBranchError } from '@work/domain/exceptions/invalid-branch.error';
import type { TaskTitle } from '@work/domain/value-objects/task-title.vo';

type BranchType = 'feat' | 'fix' | 'refactor' | 'test' | 'docs' | 'chore';

const CONVENTIONAL = /^\s*([a-z]+)(\([^)]*\))?!?:\s*/i;

const CONVENTIONAL_TYPES: ReadonlyMap<string, BranchType> = new Map([
  ['feat', 'feat'],
  ['feature', 'feat'],
  ['fix', 'fix'],
  ['bugfix', 'fix'],
  ['hotfix', 'fix'],
  ['refactor', 'refactor'],
  ['perf', 'refactor'],
  ['test', 'test'],
  ['tests', 'test'],
  ['docs', 'docs'],
  ['chore', 'chore'],
  ['build', 'chore'],
  ['ci', 'chore'],
  ['style', 'chore'],
  ['deps', 'chore'],
  ['revert', 'chore'],
]);

const LEADING_WORDS: readonly (readonly [RegExp, BranchType])[] = [
  [/^(fix|fixes|fixed|hotfix|patch|resolve|correct|repair)\b/i, 'fix'],
  [
    /^(refactor|restructure|rename|extract|simplify|split|inline|tidy|clean\s*up|move)\b/i,
    'refactor',
  ],
  [/^((add|write|cover)\s+(more\s+)?(unit\s+|e2e\s+)?)?tests?\b/i, 'test'],
  [/^(docs?|document)\b/i, 'docs'],
  [/^(revert|bump|chore|upgrade|update\s+(dependenc|deps|lock))/i, 'chore'],
];

const SLUG_LENGTH = 40;
const SHORT_ID_LENGTH = 8;

const typeOf = (title: string): BranchType => {
  const conventional = CONVENTIONAL.exec(title)?.[1]?.toLowerCase();
  const typed = conventional ? CONVENTIONAL_TYPES.get(conventional) : undefined;

  return (
    typed ??
    LEADING_WORDS.find(([rule]) => rule.test(title.trim()))?.[1] ??
    'feat'
  );
};

const slugOf = (title: string): string => {
  const words = title
    .replace(CONVENTIONAL, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0);

  let slug = '';

  for (const word of words) {
    const longer = slug ? `${slug}-${word}` : word;

    if (longer.length > SLUG_LENGTH) {
      break;
    }

    slug = longer;
  }

  return slug || words[0]?.slice(0, SLUG_LENGTH) || 'task';
};

export class Branch {
  private constructor(readonly value: string) {}

  static for(taskId: TaskId, title: TaskTitle): Branch {
    const shortId = taskId.value.replace(/-/g, '').slice(0, SHORT_ID_LENGTH);

    return new Branch(
      `${typeOf(title.value)}/${slugOf(title.value)}-${shortId}`,
    );
  }

  static of(raw: string): Branch {
    const named = raw.trim();

    if (named.length === 0) {
      throw new InvalidBranchError('name must not be empty');
    }

    return new Branch(named);
  }

  equals(other: Branch): boolean {
    return this.value === other.value;
  }
}
