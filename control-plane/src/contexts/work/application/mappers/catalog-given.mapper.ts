import type {
  CatalogRefusal,
  CatalogSkillGiven,
  CatalogToolGiven,
} from '@catalog/application/contracts/catalog.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { DeniedCatalogItem } from '@work/domain/value-objects/denied-catalog-item.vo';

const SPOTLIGHT_CATALOG = 'the Spotlight catalog';

export const CatalogGivenMapper = {
  toDeclared(given: CatalogToolGiven): DeclaredTool {
    return ToolDeclarationMapper.toDeclared({
      tool: given.id,
      integrationName: SPOTLIGHT_CATALOG,
      description: given.description,
      inputs: given.inputs,
      approval: null,
      learnedOutput: null,
    });
  },

  toFolder(given: CatalogSkillGiven): ReadySkillFolder {
    return {
      skill: {
        key: given.id,
        description: given.description,
        tools: given.tools,
      },
      files: given.files,
    };
  },

  toDenied(refusal: CatalogRefusal): DeniedCatalogItem {
    return DeniedCatalogItem.of(refusal);
  },
};
