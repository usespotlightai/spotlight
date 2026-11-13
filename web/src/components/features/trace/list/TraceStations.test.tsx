import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TraceStations } from '@/components/features/trace/list/TraceStations';
import type { InsightsTrace } from '@/lib/insights';

const stations = (count: number): InsightsTrace['stations'] =>
  Array.from({ length: count }, (_, index) => ({
    stationId: `station_${index}`,
    name: `Station ${index}`,
    color: '#edc12b',
    position: index + 1,
    count,
  }));

describe('TraceStations', () => {
  it('shows every station when three or fewer', () => {
    render(<TraceStations stations={stations(3)} errors={0} />);

    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('folds the stations past the second into a count', () => {
    render(<TraceStations stations={stations(4)} errors={0} />);

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('folds one more station to make room for the errors', () => {
    render(<TraceStations stations={stations(4)} errors={1} />);

    expect(screen.getByText('+3')).toBeInTheDocument();
    expect(screen.getByLabelText('1 error')).toHaveTextContent('1');
  });

  it('says nothing about errors when there are none', () => {
    render(<TraceStations stations={stations(2)} errors={0} />);

    expect(screen.queryByLabelText(/error/)).not.toBeInTheDocument();
  });
});
