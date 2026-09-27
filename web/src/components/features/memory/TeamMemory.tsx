import { useSearchParams } from 'react-router';
import { FocusedMemory } from '@/components/features/memory/FocusedMemory';
import { TeamMemoryList } from '@/components/features/memory/TeamMemoryList';
import { useLines } from '@/hooks/api/useLines';
import { FOCUS_PARAM, filterOf, paramsOf } from '@/lib/memory';

type TeamMemoryProps = {
  slug: string;
  teamId: string;
};

export function TeamMemory({ slug, teamId }: TeamMemoryProps) {
  const [params, setParams] = useSearchParams();
  const filter = filterOf(params);
  const focused = params.get(FOCUS_PARAM);
  const lines = useLines(teamId).data ?? [];

  return focused ? (
    <FocusedMemory
      slug={slug}
      teamId={teamId}
      memoryId={focused}
      lines={lines}
      onShowAll={() => setParams(paramsOf(filter), { replace: true })}
    />
  ) : (
    <TeamMemoryList
      slug={slug}
      teamId={teamId}
      filter={filter}
      lines={lines}
      onFilter={(next) => setParams(paramsOf(next), { replace: true })}
    />
  );
}
