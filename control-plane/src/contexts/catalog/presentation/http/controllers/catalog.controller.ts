import type { CatalogResolution } from '@catalog/application/dto/catalog-item.dto';
import { ResolveCatalogItemQuery } from '@catalog/application/queries/resolve-catalog-item.query';
import {
  CatalogSkillResponseDto,
  CatalogToolResponseDto,
} from '@catalog/presentation/http/dto/catalog-item.response.dto';
import { HttpStatus, Param, Query } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiParam } from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import { ApiProblemResponse } from '@platform/http/resources/conventional-api';
import {
  type DataSourceQuery,
  dataSourceApi,
} from '@platform/http/resources/data-source-api';
import { ProblemException } from '@platform/http/resources/problem.exception';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const TOOL = 'catalog-tool';

const SKILL = 'catalog-skill';

const asking = (example: string): readonly DataSourceQuery[] => [
  { name: 'name', description: 'Its name in the catalog', example },
  {
    name: 'version',
    description:
      'The versions you accept, as Terraform writes a constraint; the newest it accepts is answered',
    example: '~> 1.0',
  },
];

const CatalogTools = dataSourceApi({
  kind: TOOL,
  tag: 'catalog',
  representation: CatalogToolResponseDto,
  query: asking('web-search'),
});

const CatalogSkills = dataSourceApi({
  kind: SKILL,
  tag: 'catalog',
  representation: CatalogSkillResponseDto,
  query: asking('research'),
});

const WORKSPACE = ApiParam({
  name: 'workspaceId',
  example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
});

const ApiNotEntitledResponse = (kind: string) =>
  ApiProblemResponse(
    HttpStatus.FORBIDDEN,
    `The workspace’s plan does not include the ${kind}; the detail names the plan it needs`,
  );

const notEntitled = (kind: string, detail: string): ProblemException =>
  ProblemException.of({
    slug: 'not-entitled',
    title: `The workspace’s plan does not include this ${kind}`,
    status: HttpStatus.FORBIDDEN,
    detail,
  });

const answered = <R>(
  kind: string,
  resolution: CatalogResolution | null,
  answer: (item: Extract<CatalogResolution, { outcome: 'resolved' }>) => R,
): R => {
  switch (resolution?.outcome) {
    case 'resolved':
      return answer(resolution);
    case 'invalid':
      throw ProblemException.invalid(kind, resolution.problems);
    case 'unmatched':
      throw ProblemException.notFound(kind, resolution.because);
    case 'not-entitled':
      throw notEntitled(kind, resolution.because);
    default:
      throw ProblemException.notFound(kind);
  }
};

@CatalogTools.Controller()
export class CatalogController {
  constructor(private readonly queryBus: QueryBus) {}

  @CatalogTools.Read(
    'workspaces/:workspaceId/catalog/tools',
    'Resolve a catalog tool by name and version constraint, if the workspace’s plan includes it',
  )
  @ApiNotEntitledResponse(TOOL)
  @WORKSPACE
  async tool(
    @Param('workspaceId') workspaceId: string,
    @Query('name') name: string | undefined,
    @Query('version') version: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<CatalogToolResponseDto> {
    return answered(
      TOOL,
      await this.resolve(workspaceId, 'tool', name, version, principal),
      ({ item }) => new CatalogToolResponseDto(item),
    );
  }

  @CatalogSkills.Read(
    'workspaces/:workspaceId/catalog/skills',
    'Resolve a catalog skill by name and version constraint, if the workspace’s plan includes it',
  )
  @ApiNotEntitledResponse(SKILL)
  @WORKSPACE
  async skill(
    @Param('workspaceId') workspaceId: string,
    @Query('name') name: string | undefined,
    @Query('version') version: string | undefined,
    @CurrentPrincipal() principal: Principal,
  ): Promise<CatalogSkillResponseDto> {
    return answered(
      SKILL,
      await this.resolve(workspaceId, 'skill', name, version, principal),
      ({ item }) => new CatalogSkillResponseDto(item),
    );
  }

  private resolve(
    workspaceId: string,
    kind: ResolveCatalogItemQuery['kind'],
    name: string | undefined,
    version: string | undefined,
    principal: Principal,
  ): Promise<CatalogResolution | null> {
    return this.queryBus.execute<
      ResolveCatalogItemQuery,
      CatalogResolution | null
    >(
      new ResolveCatalogItemQuery(
        workspaceId,
        kind,
        name ?? '',
        version ?? '',
        principal,
      ),
    );
  }
}
