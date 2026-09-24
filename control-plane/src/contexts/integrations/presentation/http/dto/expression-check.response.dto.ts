import {
  EXPRESSION_ALSO_SEES_NAMES,
  EXPRESSION_RETURNS_NAMES,
  type ExpressionCheckDto,
  type ExpressionDeclarationDto,
  type ExpressionErrorDto,
  type ExpressionPositionDto,
  type ExpressionSpanDto,
  type ExpressionWarningDto,
} from '@integrations/application/dto/expression-check.dto';
import { ApiProperty } from '@nestjs/swagger';

export class ExpressionSpanResponseDto {
  @ApiProperty({ example: 6, description: 'Where it starts, in characters' })
  readonly start: number;

  @ApiProperty({ example: 14, description: 'Where it ends, exclusive' })
  readonly end: number;

  constructor(span: ExpressionSpanDto) {
    this.start = span.start;
    this.end = span.end;
  }
}

export class ExpressionErrorResponseDto {
  @ApiProperty({ example: 'No such key: argumnts' })
  readonly message: string;

  @ApiProperty({
    type: ExpressionSpanResponseDto,
    nullable: true,
    description: 'The part of the expression it is about',
  })
  readonly span: ExpressionSpanResponseDto | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'event.arguments',
    description: 'The declared name nearest one that is not there',
  })
  readonly suggestion: string | null;

  constructor(error: ExpressionErrorDto) {
    this.message = error.message;
    this.span = error.span ? new ExpressionSpanResponseDto(error.span) : null;
    this.suggestion = error.suggestion;
  }
}

export class ExpressionWarningResponseDto {
  @ApiProperty({
    example: 'integration.webhook.events[0].lookup.capture.body',
    description: 'The attribute it is about',
  })
  readonly position: string;

  @ApiProperty({ example: 'shadows the built-in body' })
  readonly message: string;

  constructor(warning: ExpressionWarningDto) {
    this.position = warning.position.rendered;
    this.message = warning.message;
  }
}

export class ExpressionCheckResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: 'bool',
    description:
      'The CEL type it evaluates to; dyn where that depends on what the host sends, null where it does not check at all',
  })
  readonly type: string | null;

  @ApiProperty({
    type: ExpressionErrorResponseDto,
    isArray: true,
    description: 'Empty when the expression is sound where it is written',
  })
  readonly errors: readonly ExpressionErrorResponseDto[];

  @ApiProperty({
    type: ExpressionWarningResponseDto,
    isArray: true,
    description:
      'What the definition does that the expression may not expect, such as a capture shadowing a built-in name',
  })
  readonly warnings: readonly ExpressionWarningResponseDto[];

  constructor(check: ExpressionCheckDto) {
    this.type = check.type;
    this.errors = check.errors.map(
      (each) => new ExpressionErrorResponseDto(each),
    );
    this.warnings = check.warnings.map(
      (each) => new ExpressionWarningResponseDto(each),
    );
  }
}

export class ExpressionDeclarationResponseDto {
  @ApiProperty({ example: 'task' })
  readonly name: string;

  @ApiProperty({
    example: 'object',
    description: 'A CEL type, or object where it has fields',
  })
  readonly type: string;

  @ApiProperty({
    type: () => ExpressionDeclarationResponseDto,
    isArray: true,
  })
  readonly fields: readonly ExpressionDeclarationResponseDto[];

  constructor(declaration: ExpressionDeclarationDto) {
    this.name = declaration.name;
    this.type = declaration.type;
    this.fields = declaration.fields.map(
      (each) => new ExpressionDeclarationResponseDto(each),
    );
  }
}

export class ExpressionPositionResponseDto {
  @ApiProperty({
    example: 'integration.webhook.events[*].when',
    description:
      'Where an expression is written, with [*] for any list index or map key; a check names the concrete attribute and resolves it against the supplied definition',
  })
  readonly position: string;

  @ApiProperty({
    type: String,
    nullable: true,
    enum: [...EXPRESSION_RETURNS_NAMES],
    description: 'What an expression here must return, where it matters',
  })
  readonly returns: string | null;

  @ApiProperty({
    type: ExpressionDeclarationResponseDto,
    isArray: true,
    description:
      'The names an expression here may read before the definition adds its own; type hints in the definition refine body and response',
  })
  readonly sees: readonly ExpressionDeclarationResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    enum: [...EXPRESSION_ALSO_SEES_NAMES],
    description:
      'What the definition adds here: item where the event has a forEach, the names its lookup captures, the inputs of the tools that do the action',
  })
  readonly alsoSees: readonly string[];

  constructor(position: ExpressionPositionDto) {
    this.position = position.position.rendered;
    this.returns = position.returns;
    this.sees = position.sees.map(
      (each) => new ExpressionDeclarationResponseDto(each),
    );
    this.alsoSees = position.alsoSees;
  }
}
