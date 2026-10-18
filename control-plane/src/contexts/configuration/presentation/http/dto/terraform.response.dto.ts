import type {
  ResourceHcl,
  TerraformFile,
} from '@configuration/presentation/terraform/terraform-configuration';
import { ApiProperty } from '@nestjs/swagger';

export class TerraformFileResponseDto {
  @ApiProperty({
    example: 'prompts/core/delivery/implementation.md',
    description: 'Where the file goes, relative to the Terraform module',
  })
  readonly path: string;

  @ApiProperty({ example: 'Implement the task.' })
  readonly content: string;

  constructor(file: TerraformFile) {
    this.path = file.path;
    this.content = file.content;
  }
}

export class WorkspaceTerraformResponseDto {
  @ApiProperty({
    type: TerraformFileResponseDto,
    isArray: true,
    description:
      'main.tf, with an import block beside each resource and references between them; variables.tf, declaring a sensitive variable for each value Spotlight never returns (secret values, runner tokens); and every prompt and skill file main.tf reads with file(), byte for byte; ordered by path',
  })
  readonly files: readonly TerraformFileResponseDto[];

  constructor(files: readonly TerraformFile[]) {
    this.files = files.map((each) => new TerraformFileResponseDto(each));
  }
}

export class ResourceHclResponseDto {
  @ApiProperty({
    example:
      'import {\n  to = spotlight_team.core\n  id = "5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57/core"\n}\n\nresource "spotlight_team" "core" {\n  workspace_id = spotlight_workspace.acme.id\n  key          = "core"\n  name         = "Core"\n}\n',
    description:
      'The resource as HCL, formatted as terraform fmt would: any variable it reads, then an import block that imports it, then the resource, referring to the resources it names',
  })
  readonly hcl: string;

  @ApiProperty({
    type: TerraformFileResponseDto,
    isArray: true,
    description: 'The prompt and skill files the HCL reads with file()',
  })
  readonly files: readonly TerraformFileResponseDto[];

  constructor(rendered: ResourceHcl) {
    this.hcl = rendered.hcl;
    this.files = rendered.files.map(
      (each) => new TerraformFileResponseDto(each),
    );
  }
}
