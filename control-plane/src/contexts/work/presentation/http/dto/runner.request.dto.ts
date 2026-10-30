import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_STARTED_CHECKOUTS } from '@work/domain/value-objects/starting-point.vo';

export class RunEventRequestDto {
  @ApiProperty({ example: 1, description: 'Assigned by the runner, gapless' })
  readonly seq!: number;

  @ApiProperty({ example: 'output' })
  readonly type!: string;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  readonly at!: string;

  @ApiPropertyOptional()
  readonly message?: string;

  @ApiPropertyOptional({
    description: 'One session update as the agent reported it, JSON, base64',
  })
  readonly data?: string;
}

export class AppendRunEventsRequestDto {
  @ApiProperty({ type: RunEventRequestDto, isArray: true })
  readonly events!: RunEventRequestDto[];
}

export class HandoverDto {
  @ApiProperty({
    example: 'code-review',
    description:
      'The key of the station to pass the task to, as in code-review; "review" to ask a person; or "done" to close the task at its current station. Anything this line does not know is treated as a question for a person.',
  })
  readonly next!: string;

  @ApiPropertyOptional({
    example: 'Reproduced on restart. Needs a spec for draining the queue.',
    description: 'What the next station, or the person, should know',
  })
  readonly note?: string;
}

export class CompleteRunRequestDto {
  @ApiProperty({ example: 0 })
  readonly exitCode!: number;

  @ApiProperty({ example: false })
  readonly failed!: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'With failed: it failed before the agent was handed the run, while the runner made its workspace ready',
  })
  readonly setupFailed?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'With failed: its host stopped it for running past its time; the run is then treated as a runner that went silent, as Work would after its lease expired',
  })
  readonly timedOut?: boolean;

  @ApiPropertyOptional()
  readonly message?: string;

  @ApiPropertyOptional({ type: HandoverDto })
  readonly handover?: HandoverDto;

  @ApiPropertyOptional({
    example: '67e5ddad-0fc6-4a33-90df-3c17732132c8',
    description:
      'What the harness called this conversation. Reported rather than ' +
      'remembered by the runner, because the next run may fall to another one.',
  })
  readonly sessionId?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'A person stopped the run rather than the agent finishing it.',
  })
  readonly stopped?: boolean;
}

export class EnqueueRunRequestDto {
  @ApiProperty({
    example: 'claude-code',
    description:
      'The harness to work this run. Only runners that have it may take it.',
  })
  readonly harness!: string;

  @ApiProperty({
    description:
      'Sent to the runner unchanged: checkouts, briefing, handover and ' +
      'resume. The command is filled in from the harness, so it is not ' +
      'sent here.',
    example: {
      checkouts: [
        { remote: 'https://github.com/org/service', path: 'service' },
      ],
    },
  })
  readonly spec!: Record<string, unknown>;
}

export class AckMessagesRequestDto {
  @ApiProperty({
    example: 4,
    description: 'The agent got all the messages up to and including this note',
  })
  readonly upTo!: number;
}

export class RecordRunImageRequestDto {
  @ApiProperty({
    example:
      'ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a4b3c8e6f1a2d5c7b9e0f3a4d6c8b1e2f5a7c9d0b3e6f8a1c4d7e',
    description: 'The image the sandbox started from, named by its digest',
  })
  readonly image!: string;
}

export class StartedCheckoutRequestDto {
  @ApiProperty({
    example: 'service',
    description:
      'The checkout, by its path in the workspace, as the run received it',
  })
  readonly path!: string;

  @ApiProperty({
    example: '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a',
    description:
      'The commit HEAD was at once the workspace was restored and the checkout prepared, as its full SHA',
  })
  readonly commit!: string;
}

export class RecordStartingPointRequestDto {
  @ApiProperty({
    example: 1,
    description:
      'The attempt of the run assigned to the runner, as the claim named it',
  })
  readonly attempt!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '0b8e2f4c-6a1d-4e3b-9c7f-5d2a8e1b4c6f',
    description:
      'The workspace archive the run restored, or null where it started afresh',
  })
  readonly archiveId!: string | null;

  @ApiProperty({
    type: StartedCheckoutRequestDto,
    isArray: true,
    maxItems: MAX_STARTED_CHECKOUTS,
  })
  readonly checkouts!: StartedCheckoutRequestDto[];
}

export class RunAttachmentResponseDto {
  @ApiProperty({ example: '5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47' })
  readonly id: string;

  @ApiProperty({
    example:
      '.spotlight/attachments/5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47/queue-stuck.png',
    description: 'Where in the workspace to put it',
  })
  readonly path: string;

  constructor(id: string, path: string) {
    this.id = id;
    this.path = path;
  }
}

export class PendingMessageResponseDto {
  @ApiProperty({ example: 4 })
  readonly position: number;

  @ApiProperty({ example: 'Cap the retries at 500 while you are in there.' })
  readonly body: string;

  @ApiProperty({
    type: RunAttachmentResponseDto,
    isArray: true,
    description: 'Files to lay out before the words are sent',
  })
  readonly attachments: readonly RunAttachmentResponseDto[];

  constructor(
    position: number,
    body: string,
    attachments: readonly RunAttachmentResponseDto[],
  ) {
    this.position = position;
    this.body = body;
    this.attachments = attachments;
  }
}

export class ReplyToReviewCommentRequestDto {
  @ApiProperty({
    example: 'c3',
    description: 'Which review comment, as the briefing named it',
  })
  readonly handle!: string;

  @ApiProperty({ example: 'Split out in 4a1c2b0.' })
  readonly body!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Resolve the thread as well as replying to it',
  })
  readonly resolve?: boolean;
}

export class AskPermissionRequestDto {
  @ApiPropertyOptional({
    example: '0f6c2b1e-4d7a-4b8e-9c21-5a3e7d9f1b60',
    description:
      'The harness session asking, so the run that takes the task up again after the answer carries on in it',
  })
  readonly sessionId?: string;

  @ApiPropertyOptional({
    example: 'execute',
    description:
      'The ACP tool kind the harness sent, as in read, edit or execute',
  })
  readonly kind?: string;

  @ApiPropertyOptional({
    example: '`git push origin main`',
    description: 'What the harness said it wants to do',
  })
  readonly title?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    example: { command: 'git push origin main' },
    description: 'The tool call’s raw input, as the harness sent it',
  })
  readonly input?: unknown;
}
