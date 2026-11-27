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

  @ApiProperty({
    example: false,
    description:
      'Whether another workspace uses the installation, so this one cannot connect it',
  })
  readonly usedElsewhere: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Tidepool Labs',
    description:
      'The name of the workspace that uses the installation, where the caller is a member of it',
  })
  readonly usedBy: string | null;

  constructor(
    id: string,
    account: string,
    usedElsewhere: boolean,
    usedBy: string | null,
  ) {
    this.id = id;
    this.account = account;
    this.usedElsewhere = usedElsewhere;
    this.usedBy = usedBy;
  }
}
