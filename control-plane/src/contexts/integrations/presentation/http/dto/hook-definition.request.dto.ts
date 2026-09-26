import { HOOK_EVENTS } from '@integrations/domain/value-objects/hook-event.vo';
import {
  HookMatchDto,
  HookOidcDto,
  HookStepDto,
} from '@integrations/presentation/http/dto/hook-resource.response.dto';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class HookSigningRequestDto {
  @ApiPropertyOptional({
    example: 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw',
    description:
      'The HMAC secret, whsec_ and 24 to 64 base64 bytes; write-only, sent when secretVersion changes',
    writeOnly: true,
  })
  readonly secret?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'The version of secret; change it to rotate secret',
  })
  readonly secretVersion?: number;

  @ApiPropertyOptional({
    type: HookOidcDto,
    description: 'Sign each request with a short-lived OIDC token instead',
  })
  readonly oidc?: HookOidcDto;
}

export class HookDefinitionRequestDto {
  @ApiProperty({ example: 'migrations-need-a-dba' })
  readonly key!: string;

  @ApiProperty({ enum: HOOK_EVENTS, example: 'pull-request.opening' })
  readonly on!: string;

  @ApiPropertyOptional({ type: HookMatchDto })
  readonly match?: HookMatchDto;

  @ApiPropertyOptional({
    example: 'event.changed.exists(path, path.startsWith(vars.migrations))',
  })
  readonly when?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { migrations: 'db/migrations/' },
  })
  readonly vars?: Record<string, string>;

  @ApiProperty({ type: [HookStepDto] })
  readonly steps!: HookStepDto[];

  @ApiPropertyOptional({ type: HookSigningRequestDto, nullable: true })
  readonly signing?: HookSigningRequestDto | null;

  @ApiPropertyOptional({ enum: ['continue', 'block'], example: 'continue' })
  readonly failure?: string;

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 30 })
  readonly timeoutSeconds?: number;
}
