import { ConfigFolderUnreachableError } from '@work/domain/exceptions/config-folder-unreachable.error';
import { SetupNeedsAnAdminError } from '@work/domain/exceptions/setup-needs-an-admin.error';
import { SetupNeedsEgressError } from '@work/domain/exceptions/setup-needs-egress.error';
import type { ConfigFolder } from '@work/domain/value-objects/config-folder.vo';

export interface SetupReadiness {
  readonly codeReachable: boolean;
  readonly egressAvailable: boolean;
}

export interface SetupFacts extends SetupReadiness {
  readonly requesterIsAdmin: boolean;
}

export type SetupRefusal =
  | 'needs-an-admin'
  | 'code-unreachable'
  | 'needs-egress';

const workspaceRefusalOf = (readiness: SetupReadiness): SetupRefusal | null => {
  if (!readiness.codeReachable) {
    return 'code-unreachable';
  }

  return readiness.egressAvailable ? null : 'needs-egress';
};

export const SetupAdmission = {
  refusalOf(facts: SetupFacts): SetupRefusal | null {
    return facts.requesterIsAdmin
      ? workspaceRefusalOf(facts)
      : 'needs-an-admin';
  },

  readyIn(readiness: SetupReadiness): boolean {
    return workspaceRefusalOf(readiness) === null;
  },

  admitted(folder: ConfigFolder, facts: SetupFacts): ConfigFolder {
    const refusal = SetupAdmission.refusalOf(facts);

    if (refusal === 'needs-an-admin') {
      throw new SetupNeedsAnAdminError();
    }

    if (refusal === 'code-unreachable') {
      throw new ConfigFolderUnreachableError(folder.repository.value);
    }

    if (refusal === 'needs-egress') {
      throw new SetupNeedsEgressError();
    }

    return folder;
  },
};
