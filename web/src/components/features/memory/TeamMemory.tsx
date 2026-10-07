import { useSearchParams } from 'react-router';
import { TeamMemoryList } from '@/components/features/memory/TeamMemoryList';
import { useLines } from '@/hooks/api/useLines';
import { FOCUS_PARAM, filterOf, WRITE_PARAM } from '@/lib/memory';

type TeamMemoryProps = {
  slug: string;
  teamId: string;
};

export function TeamMemory({ slug, teamId }: TeamMemoryProps) {
  const [params, setParams] = useSearchParams();
  const lines = useLines(teamId).data ?? [];

  return (
    <TeamMemoryList
      slug={slug}
      teamId={teamId}
      filter={filterOf(params)}
      opened={params.get(FOCUS_PARAM)}
      writing={params.has(WRITE_PARAM)}
      onWritten={() =>
        setParams(
          (was) => {
            const next = new URLSearchParams(was);
            next.delete(WRITE_PARAM);
            return next;
          },
          { replace: true },
        )
      }
      lines={lines}
    />
  );
}
