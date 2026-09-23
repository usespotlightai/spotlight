import {
  CONFIGURED_INTEGRATION_STANDINGS,
  type ConfiguredIntegrationDto,
} from '@configuration/application/dto/configuration.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ConfiguredIntegrationResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({ example: 'Linear' })
  readonly name: string;

  @ApiProperty({
    description: 'Where the integration is defined',
    example: '.spotlight/integrations/linear.yml',
  })
  readonly path: string;

  @ApiProperty({
    description:
      'Whether the team is linked to the host: it only listens, it links by authorizing and has not, or it has',
    enum: CONFIGURED_INTEGRATION_STANDINGS,
    example: 'linked',
  })
  readonly standing: ConfiguredIntegrationDto['standing'];

  @ApiProperty({
    description: 'What the host calls the team once linked, where it says',
    example: 'Acme',
    nullable: true,
    type: String,
  })
  readonly handle: string | null;

  constructor(
    source: string,
    name: string,
    path: string,
    standing: ConfiguredIntegrationDto['standing'],
    handle: string | null,
  ) {
    this.source = source;
    this.name = name;
    this.path = path;
    this.standing = standing;
    this.handle = handle;
  }
}

export class ConfigurationResponseDto {
  @ApiProperty({ type: ConfiguredIntegrationResponseDto, isArray: true })
  readonly integrations: readonly ConfiguredIntegrationResponseDto[];

  constructor(integrations: readonly ConfiguredIntegrationResponseDto[]) {
    this.integrations = integrations;
  }
}
