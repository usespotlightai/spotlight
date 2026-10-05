import type {
  HostConnectionsDto,
  OwnConnectionDto,
  PersonConnectionDto,
} from '@integrations/application/dto/host-connections.dto';
import { ApiProperty } from '@nestjs/swagger';

export class OwnConnectionResponseDto {
  @ApiProperty({ example: 'linear' })
  readonly source: string;

  @ApiProperty({
    description: 'What the host calls the person, where it says',
    example: '@alice',
    nullable: true,
    type: String,
  })
  readonly handle: string | null;

  @ApiProperty({ example: '2026-10-05T10:00:00.000Z' })
  readonly connectedAt: string;

  constructor(connection: OwnConnectionDto) {
    this.source = connection.source;
    this.handle = connection.handle;
    this.connectedAt = connection.connectedAt.toISOString();
  }
}

export class PersonConnectionResponseDto extends OwnConnectionResponseDto {
  @ApiProperty({ example: 'user_1' })
  readonly personId: string;

  @ApiProperty({ example: 'Alice Martin' })
  readonly name: string;

  constructor(connection: PersonConnectionDto) {
    super(connection);
    this.personId = connection.personId;
    this.name = connection.name;
  }
}

export class HostConnectionsResponseDto {
  @ApiProperty({
    type: OwnConnectionResponseDto,
    isArray: true,
    description: 'The connections the caller made themselves',
  })
  readonly mine: readonly OwnConnectionResponseDto[];

  @ApiProperty({
    type: PersonConnectionResponseDto,
    isArray: true,
    nullable: true,
    description:
      'Who in the team has connected what, shown to admins only; it never holds a token',
  })
  readonly people: readonly PersonConnectionResponseDto[] | null;

  constructor(connections: HostConnectionsDto) {
    this.mine = connections.mine.map(
      (each) => new OwnConnectionResponseDto(each),
    );
    this.people =
      connections.people?.map(
        (each) => new PersonConnectionResponseDto(each),
      ) ?? null;
  }
}
