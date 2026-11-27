import { ApiProperty } from '@nestjs/swagger';

export class GitHubInstallationResponseDto {
  @ApiProperty({
    example: '81234567',
    description: 'The installation id that GitHub assigned',
  })
  readonly id: string;

  @ApiProperty({
    example: 'acme',
    description: 'The GitHub organisation or user the App is installed on',
  })
  readonly account: string;

  constructor(id: string, account: string) {
    this.id = id;
    this.account = account;
  }
}
