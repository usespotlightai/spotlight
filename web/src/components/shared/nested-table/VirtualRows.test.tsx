import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { VirtualRows } from '@/components/shared/nested-table/VirtualRows';

describe('VirtualRows', () => {
  it('renders only the rows near the viewport', () => {
    render(
      <ul>
        <VirtualRows count={500} estimate={100}>
          {(index) => <li>{`Row ${index}`}</li>}
        </VirtualRows>
      </ul>,
    );

    expect(screen.getAllByText(/^Row /).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^Row /).length).toBeLessThan(50);
  });
});
