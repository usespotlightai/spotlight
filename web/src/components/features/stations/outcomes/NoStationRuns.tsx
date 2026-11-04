import { Play } from 'lucide-react';
import { CreateTaskLink } from '@/components/features/team/CreateTaskLink';
import { EmptyFrame } from '@/components/shared/EmptyFrame';
import { EmptyState } from '@/components/shared/EmptyState';

type NoStationRunsProps = {
  slug: string;
  teamId: string;
};

export function NoStationRuns({ slug, teamId }: NoStationRunsProps) {
  return (
    <EmptyFrame>
      <EmptyState
        icon={Play}
        title="No runs yet"
        action={<CreateTaskLink slug={slug} teamId={teamId} />}
      >
        Runs show here by config once tasks reach this station.
      </EmptyState>
    </EmptyFrame>
  );
}
