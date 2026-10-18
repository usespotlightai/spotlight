import { PageNotice } from '@/components/shared/PageNotice';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { buttonVariants } from '@/components/ui/button-variants';
import type { ReplayedStation } from '@/lib/replay';
import { searchesAnchorPath } from '@/lib/search';
import { cn } from '@/lib/utils';

type SearchNotFoundProps = {
  at: ReplayedStation | null;
};

export function SearchNotFound({ at }: SearchNotFoundProps) {
  return (
    <PageNotice title="Search not found">
      <p className="text-muted-foreground text-sm">
        No search at this address. It may belong to another station.
      </p>
      {at && (
        <TrailLink
          to={searchesAnchorPath(at)}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'rounded-full bg-card shadow-none',
          )}
        >
          See the station’s searches
        </TrailLink>
      )}
    </PageNotice>
  );
}
