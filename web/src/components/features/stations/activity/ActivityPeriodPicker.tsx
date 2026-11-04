import { useSearchParams } from 'react-router';
import { RangePicker } from '@/components/shared/RangePicker';
import { asPeriod, PERIOD_RANGES } from '@/lib/insights';
import { activityPeriodOf, LIVE_CONFIG } from '@/lib/station';

const ACTIVITY_RANGES = [
  { id: LIVE_CONFIG, short: 'Live', label: 'Live config' },
  ...PERIOD_RANGES,
];

export function ActivityPeriodPicker() {
  const [params, setParams] = useSearchParams();
  const choose = (next: string) => {
    const changed = new URLSearchParams(params);

    if (next === LIVE_CONFIG) {
      changed.delete('period');
    } else {
      changed.set('period', asPeriod(next));
    }

    setParams(changed, { replace: true });
  };

  return (
    <RangePicker
      value={activityPeriodOf(params)}
      ranges={ACTIVITY_RANGES}
      onChange={choose}
    />
  );
}
