import { JOB_FUNCTIONS } from '@identity/domain/value-objects/job-function.vo';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SignupSurveyRequestDto {
  @ApiProperty({
    enum: JOB_FUNCTIONS,
    example: 'engineering',
    description: 'The job function of the person who creates the workspace',
  })
  readonly jobFunction!: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 200,
    example: 'A colleague',
    description: 'How the person heard about Spotlight, in their own words',
  })
  readonly referralSource?: string | null;
}

export class CreateWorkspaceRequestDto {
  @ApiProperty({ example: 'Acme Inc.', maxLength: 100 })
  readonly name!: string;

  @ApiProperty({
    example: 'acme-inc',
    maxLength: 48,
    description:
      'Addresses the workspace at /w/{slug}. Lowercase letters, numbers and single dashes.',
  })
  readonly slug!: string;

  @ApiProperty({
    example: 'Platform',
    maxLength: 100,
    description:
      'Names the team the workspace starts with. A workspace with no team has nowhere to put work.',
  })
  readonly teamName!: string;

  @ApiProperty({
    type: () => SignupSurveyRequestDto,
    description: 'The answers of the person who creates the workspace',
  })
  readonly survey!: SignupSurveyRequestDto;
}
