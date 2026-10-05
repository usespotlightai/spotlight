import { ApiPropertyOptional } from '@nestjs/swagger';

export const CONNECTING_FOR = ['team', 'me'] as const;

export type ConnectingFor = (typeof CONNECTING_FOR)[number];

export class ConnectIntegrationRequestDto {
  @ApiPropertyOptional({
    description:
      'Whose connection to make: the team’s, which only an admin makes, or the caller’s own',
    enum: CONNECTING_FOR,
    default: 'team',
  })
  readonly for?: ConnectingFor;

  @ApiPropertyOptional({
    description:
      'Where in the app to land once connected, as a path in a workspace’s inbox or settings; anything else lands on the team’s integrations',
    example: '/w/acme/inbox/task_1',
  })
  readonly back?: string;
}
