import { ApiProperty } from '@nestjs/swagger';

export class ConnectGitHubRequestDto {
  @ApiProperty({
    example: '81234567',
    description: 'The installation GitHub named when it sent you back',
  })
  readonly installationId!: string;
}
