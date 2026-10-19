import { INLINE_LINK } from '@/components/shared/section-link';
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
          candidate{' '}
          <span className="text-foreground">{search.candidateName}</span>
        </>
      )}{' '}
      in{' '}
      <TrailLink to={searchPath(at, search.searchId)} className={INLINE_LINK}>
        its search
      </TrailLink>
    </span>
  );
}
