import { Bell } from 'lucide-react';
import { SettingsPage } from '@/components/features/settings/SettingsPage';
import { SettingsRow } from '@/components/features/settings/SettingsRow';
import { SettingsSection } from '@/components/features/settings/SettingsSection';
import { CouldNotLoad } from '@/components/shared/CouldNotLoad';
import { RowIcon } from '@/components/shared/RowIcon';
import { IconRowSkeleton } from '@/components/shared/skeleton/IconRowSkeleton';
import { Switch } from '@/components/ui/switch';
import {
  type BrowserNotificationState,
  useBrowserNotifications,
} from '@/hooks/useBrowserNotifications';

const DESCRIPTIONS: Record<BrowserNotificationState, string> = {
  unsupported: 'This browser cannot show notifications.',
  blocked:
    'The browser blocks notifications from Spotlight. To turn them on, allow notifications for this site in the browser settings.',
  off: 'Off.',
  'on-while-open':
    'On. This browser shows new items while Spotlight is open. To turn them off, block notifications for this site in the browser settings.',
  on: 'On. This browser shows new items, also when Spotlight is closed.',
};

const FIXED: ReadonlySet<BrowserNotificationState> = new Set([
  'unsupported',
  'blocked',
  'on-while-open',
]);

const ON: ReadonlySet<BrowserNotificationState> = new Set([
  'on',
  'on-while-open',
]);

export function AccountNotifications() {
  const notifications = useBrowserNotifications();
  const { state, turnOn, turnOff } = notifications;
  const changing = turnOn.isPending || turnOff.isPending;
  const refused = turnOn.isError || turnOff.isError;

  return (
    <SettingsPage
      title="Notifications"
      description="Spotlight tells you when a new item comes into your inbox. Each browser has its own setting."
    >
      {state === null && notifications.key.isError && (
        <SettingsSection>
          <CouldNotLoad
            what="Your notification settings"
            retrying={notifications.key.isFetching}
            onRetry={() => void notifications.key.refetch()}
            className="px-4 py-6 text-center"
          />
        </SettingsSection>
      )}

      {state === null && !notifications.key.isError && (
        <SettingsSection>
          <div role="status" aria-label="Loading your notification settings">
            <IconRowSkeleton nameWidth="w-32" aboutWidth="w-64" />
          </div>
        </SettingsSection>
      )}

      {state !== null && (
        <SettingsSection title="This browser">
          <SettingsRow
            label="New inbox items"
            htmlFor="browser-notifications"
            leading={<RowIcon icon={Bell} />}
            description={
              refused
                ? 'Sorry, Spotlight could not change the setting. Please try again.'
                : DESCRIPTIONS[state]
            }
          >
            <Switch
              id="browser-notifications"
              checked={ON.has(state)}
              disabled={changing || FIXED.has(state)}
              onCheckedChange={(checked) =>
                checked ? turnOn.mutate() : turnOff.mutate()
              }
            />
          </SettingsRow>
        </SettingsSection>
      )}
    </SettingsPage>
  );
}
