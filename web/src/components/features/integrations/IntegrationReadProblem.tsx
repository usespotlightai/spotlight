import { TriangleAlert } from 'lucide-react';
import { Noted } from '@/components/shared/Noted';
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
    <Noted note={problem}>
      <span
        data-slot="integration-read-problem"
        role="img"
        aria-label="Could not be read"
        className="inline-flex shrink-0"
      >
        <TriangleAlert aria-hidden className="size-3.5 text-destructive" />
      </span>
    </Noted>
  );
}
