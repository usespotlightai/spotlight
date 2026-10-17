import { StatusDot, type Tone } from '@/components/features/runners/StatusDot';
import { type Host, hostStatus } from '@/lib/runner';

const toneOf = (host: Host): Tone => {
  if (!host.answering) {
    return 'gone';
  }
  return host.running.length > 0 ? 'busy' : 'ready';
};

export function HostStatus({ host }: { host: Host }) {
  return <StatusDot tone={toneOf(host)}>{hostStatus(host)}</StatusDot>;
}
