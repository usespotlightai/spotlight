import { MeterBar } from '@/components/features/stations/MeterBar';

export function ShareBar({ count, runs }: { count: number; runs: number }) {
  return <MeterBar share={runs > 0 ? count / runs : 0} />;
}
