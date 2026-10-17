import { CatalogItemId } from '@catalog/domain/value-objects/catalog-item-id.vo';
import type { CatalogName } from '@catalog/domain/value-objects/catalog-name.vo';
import type { CatalogVersion } from '@catalog/domain/value-objects/catalog-version.vo';
import type { Plan } from '@catalog/domain/value-objects/plan.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { InputSchema } from '@shared-kernel/domain/value-objects/input-schema.vo';

export type CatalogKind = 'tool' | 'skill';

const SKILL_FILE = 'SKILL.md';

export interface CatalogToolInput {
  readonly name: string;
  readonly schema: InputSchema;
  readonly description: string | null;
  readonly required: boolean;
  readonly defaulted: boolean;
  readonly stdin: boolean;
}

export interface CatalogSkillFile {
  readonly path: string;
  readonly text: string;
}

interface Listing {
  readonly name: CatalogName;
  readonly version: CatalogVersion;
  readonly needs: Plan;
  readonly description: string;
}

const listed = (kind: CatalogKind, listing: Listing): Listing => {
  if (listing.description.trim() === '') {
    throw new InconsistentStateError(
      `catalog ${kind}`,
      `says nothing about what ${listing.name.value} is for`,
    );
  }

  return listing;
};

export class CatalogTool {
  readonly kind = 'tool' as const;

  private constructor(
    readonly listing: Listing,
    readonly inputs: readonly CatalogToolInput[],
  ) {}

  static of(listing: Listing, inputs: readonly CatalogToolInput[]) {
    return new CatalogTool(listed('tool', listing), inputs);
  }

  get id(): CatalogItemId {
    return CatalogItemId.of(this.listing.name, this.listing.version);
  }
}

export class CatalogSkill {
  readonly kind = 'skill' as const;

  private constructor(
    readonly listing: Listing,
    readonly files: readonly CatalogSkillFile[],
    readonly brings: readonly CatalogItemId[],
  ) {}

  static of(
    listing: Listing,
    files: readonly CatalogSkillFile[],
    brings: readonly CatalogItemId[] = [],
  ) {
    if (!files.some((each) => each.path === SKILL_FILE)) {
      throw new InconsistentStateError(
        'catalog skill',
        `${listing.name.value} has no ${SKILL_FILE}`,
      );
    }

    return new CatalogSkill(listed('skill', listing), files, brings);
  }

  get id(): CatalogItemId {
    return CatalogItemId.of(this.listing.name, this.listing.version);
  }
}

export type CatalogItem = CatalogTool | CatalogSkill;
