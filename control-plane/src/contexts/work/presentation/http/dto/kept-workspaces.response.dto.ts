import { ApiProperty } from '@nestjs/swagger';

export class KeptWorkspacesResponseDto {
  @ApiProperty({
    type: [String],
    isArray: true,
    example: ['task_1-station_2'],
    description:
      'The workspace directories this runner should still be holding. ' +
      'Anything else under its workspace root has nothing left to resume ' +
      'and may be disposed of.',
  })
  readonly keys!: string[];
}
