import { WarningTooltip } from '@/components/shared/WarningTooltip';
import type { ApiSpecViewResponseDto } from '@/lib/api';
import { formatReadProblem } from '@/lib/api-spec';

type IntegrationReadProblemProps = {
  spec: ApiSpecViewResponseDto;
};

export function IntegrationReadProblem({ spec }: IntegrationReadProblemProps) {
  const problem = formatReadProblem(spec);

  if (!problem) {
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
