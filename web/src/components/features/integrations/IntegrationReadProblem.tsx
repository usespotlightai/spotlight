import { NotedWarning } from '@/components/shared/NotedWarning';
import type { DescriptionViewResponseDto } from '@/lib/api';
import { formatReadProblem } from '@/lib/described';

type IntegrationReadProblemProps = {
  described: DescriptionViewResponseDto;
};

export function IntegrationReadProblem({
  described,
}: IntegrationReadProblemProps) {
  const problem = formatReadProblem(described);

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
