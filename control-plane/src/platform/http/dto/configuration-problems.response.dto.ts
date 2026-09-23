import { ApiProperty } from '@nestjs/swagger';
import { attributePath } from '@platform/http/field-paths';
import type { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';

export class ConfigurationProblemResponseDto {
  @ApiProperty({
    example: 'lines/delivery',
    description: 'The resource the problem is in',
  })
  readonly path: string;

  @ApiProperty({
    example: 'stations[2].check',
    description: 'The field within it, as a Terraform attribute path',
  })
  readonly at: string;

  @ApiProperty({ example: 'must not be empty' })
  readonly reason: string;

  @ApiProperty({ enum: ['error', 'warning'] })
  readonly severity: 'error' | 'warning';

  constructor(problem: ConfigurationProblem) {
    this.path = problem.path;
    this.at = attributePath(problem.field);
    this.reason = problem.reason;
    this.severity = problem.severity;
  }
}

export class ConfigurationProblemsResponseDto {
  @ApiProperty({ type: ConfigurationProblemResponseDto, isArray: true })
  readonly problems: readonly ConfigurationProblemResponseDto[];

  constructor(problems: readonly ConfigurationProblem[]) {
    this.problems = problems.map(
      (each) => new ConfigurationProblemResponseDto(each),
    );
  }
}
