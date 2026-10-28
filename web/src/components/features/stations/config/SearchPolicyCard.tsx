import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  type SearchPolicy,
  searchPolicyDetail,
  searchPolicyNote,
} from '@/lib/search-policy';

export function SearchPolicyCard({ policy }: { policy: SearchPolicy }) {
  const shown = (
    <div data-slot="search-policy" className="w-fit min-w-0 cursor-default">
      <ConfigCardValue detail={searchPolicyDetail(policy)}>
        {policy.enabled ? (
          'On'
        ) : (
          <span className="text-muted-foreground">Off</span>
        )}
      </ConfigCardValue>
    </div>
  );

  return (
    <ConfigCard title="Automatic improvement">
      {policy.enabled ? (
        <WithTooltip tooltip={searchPolicyNote(policy)}>{shown}</WithTooltip>
      ) : (
        shown
      )}
    </ConfigCard>
  );
}
