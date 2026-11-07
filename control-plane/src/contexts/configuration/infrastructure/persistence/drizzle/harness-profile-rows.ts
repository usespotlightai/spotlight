import {
  ProfileSettings,
  type RawSettings,
} from '@configuration/domain/value-objects/profile-settings.vo';
import type { harnessProfile } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';
import { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';

type Row = typeof harnessProfile.$inferSelect;

const rawSettingsOf = (row: Row): RawSettings => ({
  permissions: {
    allow: row.permissions.allow,
    ask: row.permissions.ask,
    deny: row.permissions.deny,
  },
  mcpServers: row.mcpServers.map((server) => ({
    name: server.name,
    command: server.command,
    args: server.args,
    env: server.env,
  })),
  native: row.native,
});

export const storedProfileOf = (
  row: Row,
): { readonly key: ProfileKey; readonly settings: ProfileSettings } => ({
  key: ProfileKey.of(row.key),
  settings: ProfileSettings.fromRaw(rawSettingsOf(row)),
});
