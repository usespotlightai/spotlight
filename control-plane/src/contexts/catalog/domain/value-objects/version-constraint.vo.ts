import { InvalidCatalogEntryError } from '@catalog/domain/exceptions/invalid-catalog-entry.error';
import { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';

const OPERATORS = ['=', '!=', '>', '>=', '<', '<=', '~>'] as const;

type Operator = (typeof OPERATORS)[number];

const CLAUSE =
  /^(=|!=|>=|<=|>|<|~>)?\s*(0|[1-9][0-9]*)(?:\.(0|[1-9][0-9]*))?(?:\.(0|[1-9][0-9]*))?$/;

interface Clause {
  readonly operator: Operator;
  readonly version: CatalogVersion;
  readonly segments: number;
}

const EXAMPLE = 'such as ~> 1.2 or >= 1.0, < 2.0';

const clauseOf = (raw: string): Clause => {
  const found = CLAUSE.exec(raw.trim());

  if (!found) {
    throw new InvalidCatalogEntryError(
      'version',
      `Catalog version "${raw.trim()}" must be a version constraint, ${EXAMPLE}.`,
    );
  }

  const [, operator, major, minor, patch] = found;
  const segments = [major, minor, patch].filter(
    (each) => each !== undefined,
  ).length;

  return {
    operator: (operator ?? '=') as Operator,
    version: CatalogVersion.at(
      Number(major),
      Number(minor ?? 0),
      Number(patch ?? 0),
    ),
    segments,
  };
};

const pessimisticCeiling = ({ version, segments }: Clause): CatalogVersion =>
  segments === 3
    ? CatalogVersion.at(version.major, version.minor + 1)
    : CatalogVersion.at(version.major + 1);

const satisfies = (clause: Clause, version: CatalogVersion): boolean => {
  const against = version.compare(clause.version);

  switch (clause.operator) {
    case '=':
      return against === 0;
    case '!=':
      return against !== 0;
    case '>':
      return against > 0;
    case '>=':
      return against >= 0;
    case '<':
      return against < 0;
    case '<=':
      return against <= 0;
    case '~>':
      return against >= 0 && version.compare(pessimisticCeiling(clause)) < 0;
  }
};

export class VersionConstraint {
  private constructor(
    readonly value: string,
    private readonly clauses: readonly Clause[],
  ) {}

  static of(raw: string): VersionConstraint {
    const trimmed = raw.trim();

    if (trimmed === '') {
      throw new InvalidCatalogEntryError(
        'version',
        `Catalog version is required. Please set a version constraint, ${EXAMPLE}.`,
      );
    }

    return new VersionConstraint(trimmed, trimmed.split(',').map(clauseOf));
  }

  matches(version: CatalogVersion): boolean {
    return this.clauses.every((each) => satisfies(each, version));
  }

  toString(): string {
    return this.value;
  }
}
