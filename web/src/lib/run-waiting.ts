import type { QuietHostsResponseDto, RunWaitingResponseDto } from '@/lib/api';
import { formatDate } from '@/lib/date-format';

export type RunWaiting = RunWaitingResponseDto;

export type QuietHosts = QuietHostsResponseDto;

// The control plane says a queued run waits for hosts that are all offline, and names them.
export const quietHostsOf = (
  waiting: RunWaiting | null | undefined,
): QuietHosts | null =>
  waiting?.reason === 'hosts-offline' ? waiting.quiet : null;

const sameDay = (one: Date, other: Date): boolean =>
  one.toDateString() === other.toDateString();

const offlineAt = (at: string): string => {
  const since = new Date(at);

  return sameDay(since, new Date())
    ? formatDate(since, { hour: '2-digit', minute: '2-digit' })
    : formatDate(since, { month: 'short', day: 'numeric' });
};

export const offlineWordsOf = (
  quiet: QuietHosts,
  what: 'chat' | 'run',
): string => {
  const only = quiet.hosts.at(0);
  const since = quiet.since === null ? '' : ` since ${offlineAt(quiet.since)}`;

  if (only === undefined) {
    return `Queued: no host that can take this ${what} is online.`;
  }

  return quiet.hosts.length === 1
    ? `Queued: ${only}, the only host that can take this ${what}, has been offline${since}.`
    : `Queued: the ${quiet.hosts.length} hosts that can take this ${what} have been offline${since}.`;
};
