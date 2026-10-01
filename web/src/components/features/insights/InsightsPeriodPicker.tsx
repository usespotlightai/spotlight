import { useSearchParams } from 'react-router';
import { RangePicker } from '@/components/shared/RangePicker';
import { asPeriod, PERIOD_RANGES, paramsOf, viewOf } from '@/lib/insights';

export function InsightsPeriodPicker() {
  const [params, setParams] = useSearchParams();
  const view = viewOf(params);

  return (
    <RangePicker
      value={view.period}
      ranges={PERIOD_RANGES}
      onChange={(period) =>
        setParams(paramsOf({ ...view, period: asPeriod(period), page: 1 }), {
          replace: true,
        })
      }
    />
  );
}
