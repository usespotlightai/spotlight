import type {
  CatalogRefusal,
  CatalogSkillGiven,
  CatalogToolGiven,
} from '@catalog/application/contracts/catalog.contract';
import type { ReadySkillFolder } from '@work/application/dto/ready-skill.dto';
import { ToolDeclarationMapper } from '@work/application/mappers/tool-declaration.mapper';
import { CatalogWithheld } from '@work/domain/value-objects/catalog-withheld.vo';
import type { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';

export const CatalogGivenMapper = {
  toDeclared(given: CatalogToolGiven): DeclaredTool {
    return ToolDeclarationMapper.toDeclared({
      tool: given.id,
      description: given.description,
      inputs: given.inputs,
      approval: null,
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

  toWithheld(refusal: CatalogRefusal): CatalogWithheld {
    return CatalogWithheld.of(refusal);
  },
};
