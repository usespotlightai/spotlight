import { ApiProperty } from '@nestjs/swagger';

export class InviteToTeamRequestDto {
  @ApiProperty({
    description: 'Where the invitation is sent, and who may accept it.',
    example: 'ada@example.com',
  })
  readonly email!: string;
}
