import { ApiProperty } from '@nestjs/swagger';
import {
  PERMISSION_ANSWERS,
  type PermissionAnswer,
} from '@work/application/dto/permission-answer.dto';
import type { ToolActingAsDto } from '@work/application/ports/integration-tool-calls.port';

export class ToolActingAsResponseDto {
  @ApiProperty({
    description:
      'Whose connection the call used: the team’s, or the person’s who started the task',
    enum: ['team', 'requester'],
    example: 'requester',
  })
  readonly actsAs: 'team' | 'requester';

  @ApiProperty({
    description: 'The person whose connection it was, where it was a person’s',
    example: 'user_1',
    nullable: true,
    type: String,
  })
  readonly personId: string | null;

  @ApiProperty({
    description:
      'The account name on the service of whoever the call acted as, where the service gives it',
    example: '@alice',
    nullable: true,
    type: String,
  })
  readonly linkedAccount: string | null;

  constructor(actingAs: ToolActingAsDto) {
    this.actsAs = actingAs.actsAs;
    this.personId = actingAs.personId;
    this.linkedAccount = actingAs.linkedAccount;
  }
}

export class ToolAnswerResponseDto {
  @ApiProperty({
    description: 'What the tool answered, shaped as the tool shapes it',
    example: 'https://github.com/acme/api/pull/9',
    nullable: true,
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object' },
      { type: 'array', items: {} },
    ],
  })
  readonly output: unknown;

  @ApiProperty({
    type: ToolActingAsResponseDto,
    nullable: true,
    description:
      'Whose connection the call acted with, where its integration requires a connection',
  })
  readonly actingAs: ToolActingAsResponseDto | null;

  constructor(output: unknown, actingAs: ToolActingAsResponseDto | null) {
    this.output = output;
    this.actingAs = actingAs;
  }
}

export class PermissionAnswerResponseDto {
  @ApiProperty({
    enum: PERMISSION_ANSWERS,
    example: 'pending',
    description:
      'allow or reject answers the harness now; pending means a person was asked in their inbox, so the run should end its turn and release the task',
  })
  readonly decision: PermissionAnswer;

  constructor(decision: PermissionAnswer) {
    this.decision = decision;
  }
}
