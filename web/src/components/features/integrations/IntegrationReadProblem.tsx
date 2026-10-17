import { NotedWarning } from '@/components/shared/NotedWarning';
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
    <NotedWarning
      data-slot="integration-read-problem"
      note={problem}
      label="Could not be read"
      tone="destructive"
    />
  );
}
