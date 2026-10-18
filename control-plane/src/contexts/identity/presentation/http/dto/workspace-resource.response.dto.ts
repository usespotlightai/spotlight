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

  constructor(workspace: WorkspaceResourceDto) {
    super(workspace);
    this.name = workspace.name;
    this.slug = workspace.slug;
  }
}
