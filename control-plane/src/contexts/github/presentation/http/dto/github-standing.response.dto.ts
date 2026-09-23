import { ApiProperty } from '@nestjs/swagger';

export class GitHubStandingResponseDto {
  @ApiProperty({
    description: 'Whether the App is installed for this workspace',
  })
  readonly connected: boolean;

  @ApiProperty({
    description: 'Where to install the App, or null where GitHub would not say',
    nullable: true,
    type: String,
    example: 'https://github.com/apps/spotlight/installations/new',
  })
  readonly installUrl: string | null;

  constructor(connected: boolean, installUrl: string | null) {
    this.connected = connected;
    this.installUrl = installUrl;
  }
}
