import type {
  CatalogDenial,
  CatalogSkillEntitled,
  CatalogToolEntitled,
} from '@catalog/application/contracts/catalog.contract';
import type {
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { Denial } from '@catalog/domain/services/entitlement-resolution';

export const CatalogEntitledMapper = {
  toTool: (tool: CatalogTool): CatalogToolEntitled => ({
    id: tool.id.value,
    description: tool.metadata.description,
    inputs: tool.inputs.map((each) => ({
      ...each,
      schema: each.schema.written,
    })),
  }),

  toSkill: (skill: CatalogSkill): CatalogSkillEntitled => ({
    id: skill.id.value,
    description: skill.metadata.description,
    files: skill.files,
    tools: skill.tools.map((each) => each.value),
  }),

  toDenial: (denial: Denial): CatalogDenial => ({
    id: denial.id,
    reason: denial.reason,
    because: denial.detail,
  }),
};
