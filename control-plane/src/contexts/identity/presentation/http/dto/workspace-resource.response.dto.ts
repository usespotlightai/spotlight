import type { WorkspaceResourceDto } from '@identity/application/dto/workspace-resource.dto';
import { ApiProperty } from '@nestjs/swagger';
import { ResourceResponseDto } from '@platform/http/dto/resource.response.dto';

export class WorkspaceResourceResponseDto extends ResourceResponseDto {
  @ApiProperty({ example: 'Acme', description: 'What the workspace is called' })
  readonly name: string;

  @ApiProperty({
    example: 'acme',
    description:
      'Where the workspace lives in the web app. Immutable: changing it means replacing the workspace',
  })
  readonly slug: string;

  @ApiProperty({
    type: [String],
    example: ['api.example.com', '*.example.com'],
    description:
      "The hosts Spotlight may call for this workspace's configuration, as exact hosts or *.example.com patterns. The deployment's allowed list applies too. An empty list adds no limit. A change applies to calls in at most 30 seconds",
  })
  readonly outboundHosts: readonly string[];

  constructor(workspace: WorkspaceResourceDto) {
    super(workspace);
    this.name = workspace.name;
    this.slug = workspace.slug;
    this.outboundHosts = workspace.outboundHosts;
  }
}
