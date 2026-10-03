import { TrailLink } from '@/components/shell/layout/TrailLink';
import { memoryPath } from '@/lib/memory';

type MemoryHandleLinkProps = {
  slug: string;
  teamId: string;
  memoryId: string;
  handle: string;
};

export function MemoryHandleLink({
  slug,
  teamId,
  memoryId,
  handle,
}: MemoryHandleLinkProps) {
  return (
    <TrailLink
      to={memoryPath(slug, teamId, memoryId)}
      className="underline-offset-4 hover:text-foreground hover:underline"
    >
      {handle}
    </TrailLink>
  );
}
