import { ApiProperty } from '@nestjs/swagger';

export class ClaimHostWorkRequestDto {
  @ApiProperty({
    example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    description: 'The host claiming, as it names itself in its presence',
  })
  readonly host!: string;

  @ApiProperty({
    example: 'ghcr.io/acme/api-runner:main',
    description:
      'The runner image this claim will run in, one the host reported serving; what it holds and whether it is the default come from that report',
  })
  readonly image!: string;
}
