import {
  EXPRESSION_ADDED_VARIABLE_NAMES,
  EXPRESSION_RETURNS_NAMES,
  type ExpressionCheckDto,
  type ExpressionDeclarationDto,
  type ExpressionErrorDto,
  type ExpressionPositionDto,
  type ExpressionCallDto,
  type ExpressionSpanDto,
  type ExpressionWarningDto,
} from '@integrations/application/dto/expression-check.dto';
import { ACTION_CALLERS } from '@integrations/domain/value-objects/action-caller.vo';
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
      'The CEL type it evaluates to; dyn where that depends on what the service sends, null where it does not check at all',
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

export class ExpressionCallResponseDto {
  @ApiProperty({
    enum: [...ACTION_CALLERS],
    example: 'notice',
    description:
      'What calls the expression: a binding of a task, chat, inbox-request or notice event, a tool, or a schedule',
  })
  readonly by: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['notice', 'target', 'uploaded'],
    description:
      'The variables that depend on what calls the expression, and that this caller gives',
  })
  readonly variables: readonly string[];

  constructor(call: ExpressionCallDto) {
    this.by = call.by;
    this.variables = call.variables;
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
  readonly variables: readonly ExpressionDeclarationResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    enum: [...EXPRESSION_ADDED_VARIABLE_NAMES],
    description:
      'What the definition adds here: item where the event has a forEach, the names its lookup captures, the inputs of the tools that do the action',
  })
  readonly addedVariables: readonly string[];

  @ApiProperty({
    type: ExpressionCallResponseDto,
    isArray: true,
    description:
      'What can call an expression here, each with the variables it gives. The expression is checked for each caller that the definition has: a binding for the events whose bindings name it, a tool or a schedule for the actions they name. Where the definition has no such caller, it is checked against all of them. Empty where the variables do not depend on what calls the expression',
  })
  readonly calls: readonly ExpressionCallResponseDto[];

  constructor(position: ExpressionPositionDto) {
    this.position = position.position.rendered;
    this.returns = position.returns;
    this.variables = position.variables.map(
      (each) => new ExpressionDeclarationResponseDto(each),
    );
    this.addedVariables = position.addedVariables;
    this.calls = position.calls.map(
      (each) => new ExpressionCallResponseDto(each),
    );
  }
}
