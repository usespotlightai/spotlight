import { DeltaMark } from '@/components/features/insights/DeltaMark';
import { TallySparkline } from '@/components/features/insights/TallySparkline';
import { changeShown, type StationReport, trendOf } from '@/lib/insights';

export function StationTrend({ report }: { report: StationReport }) {
  const delta = changeShown(report.changes.runs);

  return (
    <div className="col-span-full flex items-center gap-2 @4xl:col-span-1">
      <TallySparkline trend={trendOf(report.trend)} />
      {delta && <DeltaMark delta={delta} />}
    </div>
  );
}
