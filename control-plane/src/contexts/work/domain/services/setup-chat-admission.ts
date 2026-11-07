import { ConfigFolderUnreachableError } from '@work/domain/exceptions/config-folder-unreachable.error';
import { SetupNeedsAnAdminError } from '@work/domain/exceptions/setup-needs-an-admin.error';
import { SetupNeedsEgressError } from '@work/domain/exceptions/setup-needs-egress.error';
import type { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';

export interface SetupChatFacts {
  readonly requesterIsAdmin: boolean;
  readonly folderReachable: boolean;
  readonly egressAvailable: boolean;
}

export const admittedSetupFolder = (
  folder: ConfigFolder,
  facts: SetupChatFacts,
): ConfigFolder => {
  if (!facts.requesterIsAdmin) {
    throw new SetupNeedsAnAdminError();
  }

  if (!facts.folderReachable) {
    throw new ConfigFolderUnreachableError(folder.repository.value);
  }

  if (!facts.egressAvailable) {
    throw new SetupNeedsEgressError();
  }

  return folder;
};
