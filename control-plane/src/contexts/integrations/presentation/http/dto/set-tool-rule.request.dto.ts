import { PERSON_TOOL_RULES } from '@integrations/domain/value-objects/person-tool-rule.vo';
import { ApiProperty } from '@nestjs/swagger';

export class SetToolRuleRequestDto {
  @ApiProperty({
    enum: PERSON_TOOL_RULES,
    description:
      'What to ask of calls made with the caller’s connection; it can only make the team’s rule stricter',
    example: 'needs-approval',
  })
  readonly rule!: string;
}
