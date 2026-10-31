import { ConfigCard } from '@/components/features/stations/config/ConfigCard';
import { ConfigCardValue } from '@/components/features/stations/config/ConfigCardValue';
import { SearchSchedule } from '@/components/features/stations/config/SearchSchedule';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { type SearchPolicy, searchPolicyNote } from '@/lib/search-policy';

export function SearchPolicyCard({ policy }: { policy: SearchPolicy }) {
  if (!policy.enabled) {
    return (
      <ConfigCard title="Automatic improvement">
        <ConfigCardValue detail="No automatic searches">
          <span className="text-muted-foreground">Off</span>
        </ConfigCardValue>
      </ConfigCard>
    );
  }

  return (
    <ConfigCard
      title="Automatic improvement"
      action={<InfoTooltip tooltip={searchPolicyNote(policy)} />}
    >
      <SearchSchedule policy={policy} />
    </ConfigCard>
  );
}
