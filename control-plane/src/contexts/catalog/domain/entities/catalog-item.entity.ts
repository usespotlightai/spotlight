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

interface CatalogItemMetadata {
  readonly name: CatalogName;
  readonly version: CatalogVersion;
  readonly requiredPlan: Plan;
  readonly description: string;
}

const validMetadata = (
  kind: CatalogKind,
  metadata: CatalogItemMetadata,
): CatalogItemMetadata => {
  if (metadata.description.trim() === '') {
    throw new InconsistentStateError(
      `catalog ${kind}`,
      `says nothing about what ${metadata.name.value} is for`,
    );
  }

  return metadata;
};

export class CatalogTool {
  readonly kind = 'tool' as const;

  private constructor(
    readonly metadata: CatalogItemMetadata,
    readonly inputs: readonly CatalogToolInput[],
  ) {}

  static of(
    metadata: CatalogItemMetadata,
    inputs: readonly CatalogToolInput[],
  ) {
    return new CatalogTool(validMetadata('tool', metadata), inputs);
  }

  get id(): CatalogItemId {
    return CatalogItemId.of(this.metadata.name, this.metadata.version);
  }
}

export class CatalogSkill {
  readonly kind = 'skill' as const;

  private constructor(
    readonly metadata: CatalogItemMetadata,
    readonly files: readonly CatalogSkillFile[],
    readonly tools: readonly CatalogItemId[],
  ) {}

  static of(
    metadata: CatalogItemMetadata,
    files: readonly CatalogSkillFile[],
    tools: readonly CatalogItemId[] = [],
  ) {
    if (!files.some((each) => each.path === SKILL_FILE)) {
      throw new InconsistentStateError(
        'catalog skill',
        `${metadata.name.value} has no ${SKILL_FILE}`,
      );
    }

    return new CatalogSkill(validMetadata('skill', metadata), files, tools);
  }

  get id(): CatalogItemId {
    return CatalogItemId.of(this.metadata.name, this.metadata.version);
  }
}

export type CatalogItem = CatalogTool | CatalogSkill;
