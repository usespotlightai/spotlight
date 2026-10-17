import {
  EXPORTABLE_KINDS,
  type ExportableConfigurationDto,
  type ExportableKind,
  type ExportableResourceConfigurationDto,
} from '@configuration/application/dto/exportable-configuration.dto';
import { ResourceConfigurationQuery } from '@configuration/application/queries/resource-configuration.query';
import { WorkspaceConfigurationQuery } from '@configuration/application/queries/workspace-configuration.query';
import {
  ResourceHclResponseDto,
  WorkspaceTerraformResponseDto,
} from '@configuration/presentation/http/dto/terraform.response.dto';
import {
  resourceHcl,
  workspaceTerraform,
} from '@configuration/presentation/terraform/terraform-configuration';
import { Get, HttpStatus, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiOkResponse, ApiOperation, ApiParam } from '@nestjs/swagger';
import { CurrentPrincipal } from '@platform/http/decorators/current-principal.decorator';
import {
  ApiProblemResponse,
  ConventionalApiController,
  operationIdOf,
} from '@platform/http/resources/conventional-api';
import { found } from '@platform/http/resources/resource-answers';
import { RESOURCES } from '@platform/http/routes';
import type { Principal } from '@shared-kernel/domain/value-objects/principal.vo';

const COLLECTION_OF: Readonly<Record<ExportableKind, string>> = {
  workspace: 'workspaces',
  team: 'teams',
  line: 'lines',
  skill: 'skills',
  integration: 'integrations',
  hook: 'hooks',
  'harness-profile': 'harness-profiles',
  secret: 'secrets',
  'workspace-token-trust': 'token-trusts',
  'runner-trust': 'runner-trusts',
  'runner-pool': 'runner-pools',
  egress: 'egresses',
  'workspace-runners': 'workspace-runners',
};

const kindIn = (collection: string): ExportableKind | undefined =>
  EXPORTABLE_KINDS.find((kind) => COLLECTION_OF[kind] === collection);

@ConventionalApiController(RESOURCES, 'terraform')
export class TerraformController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('workspaces/:id/export')
  @ApiOperation({
    operationId: operationIdOf('export', 'workspace'),
    summary:
      'Everything in a workspace as a Terraform module that imports it, the same on every export; reading the workspace is enough',
  })
  @ApiParam({ name: 'id', example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57' })
  @ApiOkResponse({ type: WorkspaceTerraformResponseDto })
  @ApiProblemResponse(
    HttpStatus.NOT_FOUND,
    'No such workspace that you may see',
  )
  async export(
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<WorkspaceTerraformResponseDto> {
    return found(
      'workspace',
      await this.queryBus.execute<
        WorkspaceConfigurationQuery,
        ExportableConfigurationDto | null
      >(new WorkspaceConfigurationQuery(id, principal)),
      (configuration) =>
        new WorkspaceTerraformResponseDto(workspaceTerraform(configuration)),
    );
  }

  @Get(':collection/:id/hcl')
  @ApiOperation({
    operationId: operationIdOf('read', 'resource-hcl'),
    summary:
      'One resource as HCL, with the import block that adopts it and any variable it reads',
  })
  @ApiParam({
    name: 'collection',
    enum: EXPORTABLE_KINDS.map((kind) => COLLECTION_OF[kind]),
  })
  @ApiParam({ name: 'id', example: '3f7a2c9e-5d18-4b6a-8e2f-1c9d7b4a6e03' })
  @ApiOkResponse({ type: ResourceHclResponseDto })
  @ApiProblemResponse(HttpStatus.NOT_FOUND, 'No such resource that you may see')
  async hcl(
    @Param('collection') collection: string,
    @Param('id') id: string,
    @CurrentPrincipal() principal: Principal,
  ): Promise<ResourceHclResponseDto> {
    const kind = kindIn(collection);

    return found(
      kind ?? 'resource',
      kind
        ? await this.queryBus.execute<
            ResourceConfigurationQuery,
            ExportableResourceConfigurationDto | null
          >(new ResourceConfigurationQuery(kind, id, principal))
        : null,
      (exported) =>
        new ResourceHclResponseDto(
          resourceHcl(exported.configuration, exported.resource),
        ),
    );
  }
}
