import { NotedWarning } from '@/components/shared/NotedWarning';
import type { ConfiguredDescriptionResponseDto } from '@/lib/api';
import { readProblemShown } from '@/lib/described';

type IntegrationReadProblemProps = {
  described: ConfiguredDescriptionResponseDto;
};

export function IntegrationReadProblem({
  described,
}: IntegrationReadProblemProps) {
  const problem = readProblemShown(described);

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
