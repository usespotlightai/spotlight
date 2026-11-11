import { ApiProperty } from '@nestjs/swagger';

export class AvatarResponseDto {
  @ApiProperty({
    description: 'Where to read the avatar.',
    example:
      '/api/workspaces/acme-inc/avatar/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  })
  readonly avatarUrl: string;

  constructor(avatarUrl: string) {
    this.avatarUrl = avatarUrl;
  }
}
