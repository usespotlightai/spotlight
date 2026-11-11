import {
  CATALOG_INTEGRATION,
  catalogReferenceParts,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';

export const skillFolderOf = (skill: SkillKey): string =>
  skill.catalogued
    ? `spotlight-${CATALOG_INTEGRATION}-${catalogReferenceParts(skill.value).name}`
    : skill.value;
