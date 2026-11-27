import { ImprovementStatus } from '@/components/features/stations/config/ImprovementStatus';
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

type ImprovedStation = {
  slug: string;
  teamId: string;
  lineId: string;
  stationId: string;
};

type ImprovementPropertiesProps = {
  policy: SearchPolicy;
  station?: ImprovedStation;
};

export function ImprovementProperties({
  policy,
  station,
}: ImprovementPropertiesProps) {
  return (
    <TabSection
      level={3}
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
          {station && <ImprovementStatus {...station} />}
        </PropertyList>
      </div>
    </TabSection>
  );
}
