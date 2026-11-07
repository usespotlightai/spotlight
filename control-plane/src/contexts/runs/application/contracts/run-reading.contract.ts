import { hunksOf as runHunksOf } from '@runs/domain/services/change-hunks';
import {
  type ChangedPaths,
  type RepositoryFile,
  filesChangedIn as runFilesChangedIn,
  workspacePath as runWorkspacePath,
  workspacePathsIn as runWorkspacePathsIn,
} from '@runs/domain/services/workspace-path';
import { faulted } from '@runs/domain/value-objects/step-status';

export type { ChangedPaths, RepositoryFile };

export const CONNECTION_OUTCOMES = [
  'passthrough',
  'injected',
  'blocked',
  'failed',
] as const;

export type ConnectionOutcome = (typeof CONNECTION_OUTCOMES)[number];

export const CONNECTION_REASONS = [
  'not-allowed',
  'private-address',
  'not-bound',
  'no-such-host',
  'timed-out',
  'tls-failed',
  'unreachable',
] as const;

export type ConnectionReason = (typeof CONNECTION_REASONS)[number];

export const CONNECTION_ERRORS = [
  'blocked',
  'failed',
  'auth-failed',
  'server-error',
] as const;

export type ConnectionError = (typeof CONNECTION_ERRORS)[number];

export const RunReading = {
  faulted(status: string | null | undefined): boolean {
    return faulted(status);
  },

  workspacePath: runWorkspacePath,

  workspacePathsIn: runWorkspacePathsIn,

  filesChangedIn: runFilesChangedIn,

  hunksOf: runHunksOf,
};
