import { DeltaGlyph } from '@/components/features/insights/DeltaGlyph';
import { TallySparkline } from '@/components/features/insights/TallySparkline';
import { type StationReport, shownDeltaOf, trendOf } from '@/lib/insights';

export function StationTrend({ report }: { report: StationReport }) {
  const delta = shownDeltaOf(report.changes.runs);

  return (
    <div className="col-span-full flex items-center gap-2 text-xs @4xl:col-span-1">
      <TallySparkline trend={trendOf(report.trend)} />
      {delta && <DeltaGlyph delta={delta} />}
    </div>
  );
}
