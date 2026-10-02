import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { ReplaySearchResponseDto } from '@/lib/api';
import type { ReplayedStation } from '@/lib/replay';
import { SEED_NAME, searchPath } from '@/lib/search';

type SearchOriginProps = {
  at: ReplayedStation;
  search: ReplaySearchResponseDto;
};

export function SearchOrigin({ at, search }: SearchOriginProps) {
  return (
    <span data-slot="search-origin">
      {search.candidateName === SEED_NAME ? (
        'the live config it started from'
      ) : (
        <>
          candidate <span className="font-mono">{search.candidateName}</span>
        </>
      )}{' '}
      in{' '}
      <TrailLink
        to={searchPath(at, search.searchId)}
        className="text-foreground underline-offset-2 hover:underline"
      >
        its search
      </TrailLink>
    </span>
  );
}
