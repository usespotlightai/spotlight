import {
  ACTS_AS,
  type ActsAsKind,
} from '@integrations/domain/value-objects/acts-as.vo';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ConnectIntegrationRequestDto {
  @ApiPropertyOptional({
    description:
      'Whose connection to make: the team’s, which only an admin makes, or the requester’s own',
    enum: ACTS_AS,
    default: 'team',
  })
  readonly actsAs?: ActsAsKind;

  @ApiPropertyOptional({
    description:
      'Where in the app to return to after the connection, as a path in a workspace’s inbox or settings. For any other value, the app returns to the team’s integrations.',
    example: '/w/acme/inbox/task_1',
  })
  readonly returnTo?: string;
}
