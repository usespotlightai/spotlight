import { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { harnessProfile } from '@configuration/infrastructure/persistence/drizzle/schemas/configuration.schema';

type Row = typeof harnessProfile.$inferSelect;

export const storedProfileOf = (
  row: Row,
): { readonly key: ProfileKey; readonly settings: ProfileSettings } => ({
  key: ProfileKey.of(row.key),
  settings: ProfileSettings.fromRaw(row),
});
