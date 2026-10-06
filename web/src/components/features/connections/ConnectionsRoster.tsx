import { ConnectionsRosterRow } from '@/components/features/connections/ConnectionsRosterRow';
import { SettingsEmpty } from '@/components/features/settings/SettingsEmpty';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import type {
  ConfiguredIntegrationResponseDto,
  PersonConnectionResponseDto,
} from '@/lib/api';

type ConnectionsRosterProps = {
  people: readonly PersonConnectionResponseDto[];
  integrations: readonly ConfiguredIntegrationResponseDto[];
};

export function ConnectionsRoster({
  people,
  integrations,
}: ConnectionsRosterProps) {
  const named = new Map(integrations.map((each) => [each.source, each.name]));

  if (people.length === 0) {
    return (
      <SettingsEmpty>Nobody in this team has connected yet.</SettingsEmpty>
    );
  }

  return (
    <SettingsSection title="Who has connected" count={people.length}>
      {people.map((each) => (
        <ConnectionsRosterRow
          key={`${each.source}:${each.personId}`}
          connection={each}
          integration={named.get(each.source) ?? each.source}
        />
      ))}
    </SettingsSection>
  );
}
