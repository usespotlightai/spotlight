import type { SecretValueOrigin, WorkspaceSecretResponseDto } from '@/lib/api';
import { since } from '@/lib/since';

export type WorkspaceSecret = WorkspaceSecretResponseDto;

const ORIGIN_LABELS: Record<SecretValueOrigin, string> = {
  awaiting: 'Awaiting a value',
  spotlight: 'Stored in Spotlight',
  terraform: 'Set by Terraform',
};

const ORIGIN_NOTES: Record<SecretValueOrigin, string> = {
  awaiting: 'Runs that need this secret fail until a person sets its value.',
  spotlight: 'Terraform does not set this value.',
  terraform:
    'Terraform sets this value with value_wo_version. Change it in Terraform.',
};

export const describeValue = (secret: WorkspaceSecret): string =>
  secret.valueSetAt && secret.valueOrigin === 'spotlight'
    ? `Set ${since(secret.valueSetAt)}`
    : ORIGIN_LABELS[secret.valueOrigin];

export const valueNote = (secret: WorkspaceSecret): string =>
  ORIGIN_NOTES[secret.valueOrigin];

export const awaitsValue = (secret: WorkspaceSecret): boolean =>
  secret.valueOrigin === 'awaiting';

export const setValueLabel = (secret: WorkspaceSecret): string =>
  awaitsValue(secret) ? 'Set value' : 'Replace value';

export const allowsSandbox = (secret: WorkspaceSecret): boolean =>
  secret.sandbox === 'env';

export const SANDBOX_NOTE =
  'A harness profile can give its runs this value as an environment variable. The agent and every process in the sandbox can read it.';

export const describeHosts = (secret: WorkspaceSecret): string =>
  secret.hosts.length > 0 ? secret.hosts.join(', ') : 'Sent to no host';

export const UNREACHABLE_NOTE =
  'No runner pool has egress, so no run sends it.';
