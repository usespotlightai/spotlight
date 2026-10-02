import { type ReplayedChart, unchartedShown } from '@/lib/insights-candidates';

type UnchartedNotesProps = {
  chart: ReplayedChart;
  priced: boolean;
};

const NOTE = 'text-muted-foreground text-xs';

export function UnchartedNotes({ chart, priced }: UnchartedNotesProps) {
  return (
    <>
      {chart.unpriced.length > 0 && (
        <p data-slot="unpriced" className={NOTE}>
          Not priced, so not shown: {unchartedShown(chart.unpriced)}.
        </p>
      )}

      {chart.otherCurrency.length > 0 && (
        <p data-slot="other-currency" className={NOTE}>
          {priced
            ? 'Priced in another currency, so not shown: '
            : 'Nothing here is priced to set them against, so not shown: '}
          {unchartedShown(chart.otherCurrency)}.
        </p>
      )}

      {chart.unfinished.length > 0 && (
        <p data-slot="unfinished" className={NOTE}>
          Not finished, so not shown: {unchartedShown(chart.unfinished)}.
        </p>
      )}

      {chart.unscored.length > 0 && (
        <p data-slot="unscored" className={NOTE}>
          Not scored yet, so not shown: {unchartedShown(chart.unscored)}.
        </p>
      )}
    </>
  );
}
