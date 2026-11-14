import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_HANDOVER_ATTACHMENTS } from '@runs/domain/value-objects/handover.vo';
import { MAX_STARTED_CHECKOUTS } from '@runs/domain/value-objects/starting-point.vo';

export class RunEventRequestDto {
  @ApiProperty({ example: 1, description: 'Assigned by the runner, gapless' })
  readonly seq!: number;

  @ApiProperty({ example: 'tool.changed' })
  readonly type!: string;

  @ApiProperty({ example: '2026-08-23T18:00:00.000Z' })
  readonly at!: string;

  @ApiPropertyOptional()
  readonly message?: string;

  @ApiPropertyOptional({
    description: "The event's data as JSON, base64",
  })
  readonly data?: string;
}

export class AppendRunEventsRequestDto {
  @ApiProperty({ type: RunEventRequestDto, isArray: true })
  readonly events!: RunEventRequestDto[];
}

export class HoldSandboxArchiveLeaseRequestDto {
  @ApiProperty({
    example: 1,
    description:
      'The attempt of the run whose turn the archive follows, as the claim named it',
  })
  readonly attempt!: number;
}

export class HandoverDto {
  @ApiProperty({
    example: 'code-review',
    description:
      'Where the run hands its work on, as one of the hand-over options its spec names. The requester of the run reads it.',
  })
  readonly next!: string;

  @ApiPropertyOptional({
    example: 'Reproduced on restart. Needs a spec for draining the queue.',
    description: 'What whoever takes the hand-over should know',
  })
  readonly note?: string;

  @ApiPropertyOptional({
    type: [String],
    maxItems: MAX_HANDOVER_ATTACHMENTS,
    example: ['5f0c1d84-9c2e-4c8b-9a3d-2b7e6d5a1f47'],
    description:
      'Files the run uploaded for the note, by the ids its uploads were granted',
  })
  readonly attachments?: string[];
}

export class CompleteRunRequestDto {
  @ApiProperty({ example: 0 })
  readonly exitCode!: number;

  @ApiProperty({ example: false })
  readonly failed!: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'With failed: it failed before the agent was handed the run, while the runner made its working copy ready',
  })
  readonly setupFailed?: boolean;

  @ApiPropertyOptional({
    example: false,
    description:
      'With failed: its host stopped it for running past its time; the run is then treated as a runner that went silent, as after its lease expired',
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
      'The checkout, by its path in the working copy, as the run received it',
  })
  readonly path!: string;

  @ApiProperty({
    example: '4f7c2a9e1b3d5f8a0c6e2b4d7f9a1c3e5b8d0f2a',
    description:
      'The commit HEAD was at once the working copy was restored and the checkout prepared, as its full SHA',
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
      'The working copy archive the run restored, or null where it started afresh',
  })
  readonly archiveId!: string | null;

  @ApiProperty({
    type: StartedCheckoutRequestDto,
    isArray: true,
    maxItems: MAX_STARTED_CHECKOUTS,
  })
  readonly checkouts!: StartedCheckoutRequestDto[];
}
