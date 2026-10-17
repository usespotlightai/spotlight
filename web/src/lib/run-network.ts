import type {
  RunConnectionResponseDto,
  RunNetworkResponseDto,
  TraceConnectionResponseDto,
} from '@/lib/api';
import { sized } from '@/lib/attachment';
import type { Told } from '@/lib/detail';
import type { TraceNode } from '@/lib/trace';

export type ConnectionOutcome = RunConnectionResponseDto['outcome'];

type ConnectionReason = NonNullable<RunConnectionResponseDto['reason']>;

type ConnectionError = NonNullable<RunConnectionResponseDto['error']>;

export interface ConnectionGroup {
  readonly key: string;
  readonly destination: string;
  readonly outcome: ConnectionOutcome;
  readonly error: ConnectionError | null;
  readonly count: number;
  readonly bytesOut: number;
  readonly bytesIn: number;
}

const destinationOf = (connection: RunConnectionResponseDto): string =>
  connection.port === 443
    ? connection.host
    : `${connection.host}:${connection.port}`;

export const connectionGroups = (
  network: RunNetworkResponseDto,
): ConnectionGroup[] => {
  const groups = new Map<string, ConnectionGroup>();

  for (const connection of network.connections) {
    const destination = destinationOf(connection);
    const key = `${connection.error ?? connection.outcome} ${destination}`;
    const existing = groups.get(key);

    groups.set(key, {
      key,
      destination,
      outcome: connection.outcome,
      error: connection.error,
      count: (existing?.count ?? 0) + 1,
      bytesOut: (existing?.bytesOut ?? 0) + connection.bytesOut,
      bytesIn: (existing?.bytesIn ?? 0) + connection.bytesIn,
    });
  }

  return [...groups.values()].sort(
    (one, other) =>
      Number(other.error !== null) - Number(one.error !== null) ||
      other.bytesIn + other.bytesOut - (one.bytesIn + one.bytesOut) ||
      one.destination.localeCompare(other.destination),
  );
};

export const CONNECTION_OUTCOME_LABELS: Record<ConnectionOutcome, string> = {
  passthrough: 'Passthrough',
  injected: 'Injected',
  blocked: 'Blocked',
  failed: 'Failed',
};

export const OUTCOME_TOLD: Record<ConnectionOutcome, string> = {
  passthrough: 'Egress sent this traffic on and did not decrypt it.',
  injected:
    'Egress decrypted this traffic, because a secret of the run is bound to this host, and injected the secret.',
  blocked:
    'Egress stopped this traffic. The host is not on the allow-list, the address is refused, or no secret of the run is bound to the host.',
  failed:
    'Egress could not connect to the host. For example, the host name is unknown, the host did not answer, or TLS failed.',
};

export const ERROR_LABELS: Record<ConnectionError, string> = {
  blocked: 'Blocked',
  failed: 'Failed',
  'auth-failed': 'Auth failed',
  'server-error': 'Server error',
};

const REASON_TOLD: Record<ConnectionReason, string> = {
  'not-allowed':
    'Egress blocked the connection. The host is not on the allow-list of egress.',
  'address-refused':
    'Egress blocked the connection. The host has a private or local address, and the allow-list of egress does not name the host.',
  'not-bound':
    'Egress blocked the request. Egress injects a secret only for a host that a secret of the run is bound to, and no secret is bound to this host.',
  'no-such-host': 'Egress could not connect. The host name has no DNS record.',
  'timed-out': 'Egress could not connect. The host did not answer in time.',
  'tls-failed':
    'Egress could not connect. TLS to the host failed, for example because the certificate of the host is not valid.',
  unreachable: 'Egress could not connect to the host.',
};

const errorCause = (connection: TraceConnectionResponseDto): string => {
  if (connection.error === 'auth-failed') {
    return `The host refused the request with status ${connection.status}. Egress injected a secret into the request. The secret can be wrong, expired or without the necessary permission.`;
  }

  if (connection.error === 'server-error') {
    return `The host answered the request with server error ${connection.status}.`;
  }

  return connection.reason
    ? REASON_TOLD[connection.reason]
    : OUTCOME_TOLD[connection.outcome];
};

export const connectionTold = (node: TraceNode): Told | null =>
  node.connection
    ? { title: 'Cause', body: errorCause(node.connection), prose: true }
    : null;

export const REASON_LABELS: Record<ConnectionReason, string> = {
  'not-allowed': 'Not on the allow-list',
  'address-refused': 'Private address',
  'not-bound': 'No bound secret',
  'no-such-host': 'Unknown host',
  'timed-out': 'Timed out',
  'tls-failed': 'TLS failed',
  unreachable: 'No connection',
};

export const ENFORCEMENT_LABELS: Record<
  NonNullable<RunNetworkResponseDto['egressEnforcement']>,
  string
> = {
  enforced: 'Enforced',
  'not-enforced': 'Not enforced',
};

export const ENFORCEMENT_TOLD: Record<
  NonNullable<RunNetworkResponseDto['egressEnforcement']>,
  string
> = {
  enforced:
    'The runner reported that the sandbox could not connect around egress. All its traffic went through egress.',
  'not-enforced':
    'The runner reported that the sandbox could connect directly. Only tools that use the proxy went through egress. To enforce egress, set the firewall of the sandbox provider to let the sandbox connect only to egress.',
};

export const formatTraffic = (group: ConnectionGroup): string =>
  `${sized(group.bytesOut)} out · ${sized(group.bytesIn)} in`;
