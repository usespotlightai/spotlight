import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VirtualRows } from '@/components/shared/nested-table/VirtualRows';

describe('VirtualRows', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(800);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders only the rows near the viewport', async () => {
    render(
      <div>
        <ul>
          <VirtualRows count={500} estimate={100}>
            {(index) => <li>{`Row ${index}`}</li>}
          </VirtualRows>
        </ul>
      </div>,
    );

    const rows = await screen.findAllByText(/^Row /);

    expect(rows.length).toBeLessThan(50);
  });
});
