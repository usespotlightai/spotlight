import { ApiProperty } from '@nestjs/swagger';

export class StationResponseDto {
  @ApiProperty({ example: 'd41f0a2c-8b7e-4f19-9d3a-6c5e2b1a4f80' })
  readonly id: string;

  @ApiProperty({ example: 'Triage' })
  readonly name: string;

  @ApiProperty({ example: 0, description: 'Left to right across the board' })
  readonly position: number;

  constructor(id: string, name: string, position: number) {
    this.id = id;
    this.name = name;
    this.position = position;
  }
}

export class AssemblyLineResponseDto {
  @ApiProperty({ example: '7b2c9e14-3a5d-4c8f-b6e1-9d0a2f7c5b43' })
  readonly id: string;

  @ApiProperty({ example: 'Default' })
  readonly name: string;

  @ApiProperty({ type: StationResponseDto, isArray: true })
  readonly stations: StationResponseDto[];

  constructor(id: string, name: string, stations: StationResponseDto[]) {
    this.id = id;
    this.name = name;
    this.stations = stations;
  }
}
