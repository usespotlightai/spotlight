import type {
  CatalogDenial,
  CatalogSkillEntitled,
  CatalogToolEntitled,
} from '@catalog/application/contracts/catalog.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';

const SPOTLIGHT_CATALOG = 'the Spotlight catalog';

export const CatalogEntitledMapper = {
  toDeclared(tool: CatalogToolEntitled): DeclaredTool {
    return ToolDeclarationMapper.toDeclared({
      tool: tool.id,
      integrationName: SPOTLIGHT_CATALOG,
      description: tool.description,
      inputs: tool.inputs,
      approval: null,
      inferredOutput: null,
    });
  },

  toFolder(skill: CatalogSkillEntitled): ReadySkillFolder {
    return {
      skill: {
        key: skill.id,
        description: skill.description,
        tools: skill.tools,
      },
      files: skill.files,
    };
  },

  toDenied(denial: CatalogDenial): DeniedCatalogItem {
    return DeniedCatalogItem.of(denial);
  },
};
