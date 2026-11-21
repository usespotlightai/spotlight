import type {
  CatalogDenial,
  CatalogSkillShape,
  CatalogToolShape,
} from '@catalog/application/contracts/catalog.contract';
import type {
  CatalogSkill,
  CatalogTool,
} from '@catalog/domain/entities/catalog-item.entity';
import type { Denial } from '@catalog/domain/services/catalog-resolution';

export const CatalogShapeMapper = {
  toTool: (tool: CatalogTool): CatalogToolShape => ({
    id: tool.id.value,
    description: tool.metadata.description,
    inputs: tool.inputs.map((each) => ({
      ...each,
      schema: each.schema.written,
    })),
  }),

  toSkill: (skill: CatalogSkill): CatalogSkillShape => ({
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
