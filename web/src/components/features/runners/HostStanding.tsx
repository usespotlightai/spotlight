import {
  StandingDot,
  type Tone,
} from '@/components/features/runners/StandingDot';
import { type Host, standing } from '@/lib/runner';

const toneOf = (host: Host): Tone => {
  if (!host.answering) {
    return 'gone';
  }
  return host.running.length > 0 ? 'busy' : 'ready';
};

export function HostStanding({ host }: { host: Host }) {
  return <StandingDot tone={toneOf(host)}>{standing(host)}</StandingDot>;
}
