import { WarningTooltip } from '@/components/shared/WarningTooltip';
import type { ApiSpecViewResponseDto } from '@/lib/api';
import { formatReadProblem } from '@/lib/api-spec';
import { nonEmpty } from '@/lib/non-empty';

type IntegrationReadProblemProps = {
  spec: ApiSpecViewResponseDto;
};

export function IntegrationReadProblem({ spec }: IntegrationReadProblemProps) {
  const problem = formatReadProblem(spec);

  if (!nonEmpty(problem)) {
    return null;
  }

  return (
    <WarningTooltip
      data-slot="integration-read-problem"
      tooltip={problem}
      label="Could not be read"
      tone="destructive"
    />
  );
}
