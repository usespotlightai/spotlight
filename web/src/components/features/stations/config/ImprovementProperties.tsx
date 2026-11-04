import {
  Property,
  PropertyList,
} from '@/components/features/stations/config/PropertyList';
import { TabSection } from '@/components/features/stations/TabSection';
import {
  durationWords,
  type SearchPolicy,
  searchCost,
  searchPolicyNote,
} from '@/lib/search-policy';

export function ImprovementProperties({ policy }: { policy: SearchPolicy }) {
  return (
    <TabSection
      title="Automatic improvement"
      description={policy.enabled ? searchPolicyNote(policy) : undefined}
    >
      <div data-slot="search-policy">
        <PropertyList>
          {policy.enabled ? (
            <>
              <Property label="Searches">
                Every {durationWords(policy.period)}
              </Property>
              <Property label="Budget">{searchCost(policy)}</Property>
            </>
          ) : (
            <Property label="Searches">
              <span className="text-muted-foreground">Off</span>
            </Property>
          )}
        </PropertyList>
      </div>
    </TabSection>
  );
}
