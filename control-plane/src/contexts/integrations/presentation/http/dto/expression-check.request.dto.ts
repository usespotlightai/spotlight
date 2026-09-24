import { ApiProperty } from '@nestjs/swagger';

export class CheckExpressionRequestDto {
  @ApiProperty({
    example: 'integration.webhook.events[0].when',
    description:
      'The attribute that holds the expression, within the definition, written as its problems would name it',
  })
  readonly position!: string;

  @ApiProperty({
    example: 'body.type == "Issue"',
    description:
      // biome-ignore lint/suspicious/noTemplateCurlyInString: how an expression is written in a definition
      'The CEL expression alone, without ${{ }}; a templated attribute is checked one ${{ }} at a time',
  })
  readonly expression!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description:
      'The integration’s whole definition, as it would be created, which says what the position sees',
  })
  readonly definition!: Record<string, unknown>;
}
