import { PersonAvatar } from '@/components/shared/avatar/PersonAvatar';
import type { Joined } from '@/lib/integration';

type IntegrationPeopleProps = {
  joined: Joined;
};

export function IntegrationPeople({ joined }: IntegrationPeopleProps) {
  const { connected, waiting } = joined;

  return (
    <div className="flex flex-col gap-1">
      {connected.length === 0 ? (
        <span>Nobody has connected yet</span>
      ) : (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {connected.map((each) => (
            <li key={each.id} className="flex items-center gap-1.5">
              <PersonAvatar person={each} />
              {each.name}
            </li>
          ))}
        </ul>
      )}
      {waiting.length > 0 && (
        <span className="text-muted-foreground text-xs leading-5">
          Not connected: {waiting.map((each) => each.name).join(', ')}
        </span>
      )}
    </div>
  );
}
