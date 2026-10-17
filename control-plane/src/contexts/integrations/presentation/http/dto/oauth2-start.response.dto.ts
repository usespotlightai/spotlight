import { ApiProperty } from '@nestjs/swagger';

export class OAuth2StartResponseDto {
  @ApiProperty({
    description: 'Where to send the person to authorize the connection',
    example: 'https://slack.com/oauth/authorize?client_id=...&state=...',
  })
  readonly url: string;

  constructor(url: string) {
    this.url = url;
  }
}
