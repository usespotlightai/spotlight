import {
  PULL_REQUEST_TYPES,
  type PullRequestType,
} from '@outcomes/domain/value-objects/pull-request-type';

export interface PullRequestSaid {
  readonly changeTitles: readonly string[];
  readonly changeIntents: readonly string[];
  readonly title: string;
  readonly branch: string | null;
}

export const CONVENTIONAL_TYPES: ReadonlyMap<string, PullRequestType> = new Map(
  [
    ['feat', 'feature'],
    ['feature', 'feature'],
    ['fix', 'fix'],
    ['bugfix', 'fix'],
    ['hotfix', 'fix'],
    ['refactor', 'refactor'],
    ['perf', 'refactor'],
    ['test', 'tests'],
    ['tests', 'tests'],
    ['chore', 'chore'],
    ['build', 'chore'],
    ['ci', 'chore'],
    ['docs', 'chore'],
    ['style', 'chore'],
    ['deps', 'chore'],
    ['revert', 'chore'],
  ],
);

export const CONVENTIONAL = /^\s*([a-z]+)(\([^)]*\))?!?:/i;

export const LEADING_WORDS: readonly (readonly [RegExp, PullRequestType])[] = [
  [/^\s*(revert|bump|chore|upgrade|release|docs?)\b/i, 'chore'],
  [/^\s*update\s+(dependenc|deps|lock)/i, 'chore'],
  [/^\s*(add|write|cover)\s+(more\s+)?(unit\s+|e2e\s+)?tests?\b/i, 'tests'],
  [/^\s*tests?\b/i, 'tests'],
  [/^\s*(fix|fixes|fixed|hotfix|patch|resolve|correct|repair)\b/i, 'fix'],
  [
    /^\s*(refactor|restructure|rename|extract|simplify|split|inline|tidy|clean\s*up|move)\b/i,
    'refactor',
  ],
  [
    /^\s*(add|implement|introduce|support|allow|create|build|enable|show|let|offer)\b/i,
    'feature',
  ],
];

export const BRANCH_PREFIXES: readonly (readonly [RegExp, PullRequestType])[] =
  [
    [/^(feat|feature|features)[/-]/i, 'feature'],
    [/^(fix|bugfix|hotfix|bug)[/-]/i, 'fix'],
    [/^(refactor|refactoring)[/-]/i, 'refactor'],
    [/^(test|tests)[/-]/i, 'tests'],
    [/^(chore|deps|dependabot|renovate|release|docs|ci|build)[/-]/i, 'chore'],
  ];

export const UNMATCHED: PullRequestType = 'other';

const firstMatch = (
  text: string,
  rules: readonly (readonly [RegExp, PullRequestType])[],
): PullRequestType | null =>
  rules.find(([rule]) => rule.test(text))?.[1] ?? null;

const typeOfTitle = (title: string): PullRequestType | null => {
  const conventional = CONVENTIONAL.exec(title)?.[1]?.toLowerCase();

  return (
    (conventional ? CONVENTIONAL_TYPES.get(conventional) : undefined) ??
    firstMatch(title, LEADING_WORDS)
  );
};

const typeOfBranch = (branch: string | null): PullRequestType | null =>
  branch ? firstMatch(branch, BRANCH_PREFIXES) : null;

const mostOf = (types: readonly PullRequestType[]): PullRequestType | null => {
  const counts = new Map<PullRequestType, number>();

  for (const each of types) {
    counts.set(each, (counts.get(each) ?? 0) + 1);
  }

  let commonest: PullRequestType | null = null;

  for (const each of PULL_REQUEST_TYPES) {
    if (
      (counts.get(each) ?? 0) > (commonest ? (counts.get(commonest) ?? 0) : 0)
    ) {
      commonest = each;
    }
  }

  return commonest;
};

const typeOfChanges = (said: PullRequestSaid): PullRequestType | null =>
  mostOf(
    said.changeTitles.flatMap((title, at) => {
      const typed =
        typeOfTitle(title) ?? typeOfTitle(said.changeIntents[at] ?? '');
      return typed ? [typed] : [];
    }),
  );

export const pullRequestTypeOf = (said: PullRequestSaid): PullRequestType =>
  typeOfChanges(said) ??
  typeOfTitle(said.title) ??
  typeOfBranch(said.branch) ??
  UNMATCHED;
