import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { ExpandToggle } from '@/components/shared/nested-table/ExpandToggle';

function Toggling({ expandable }: { expandable: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <ExpandToggle
      expansion={{
        expanded,
        clamped: !expanded,
        expandable,
        toggle: () => setExpanded((was) => !was),
        clamp: { current: null },
      }}
    >
      Uploads retry in the request
    </ExpandToggle>
  );
}

describe('ExpandToggle', () => {
  it('flips whether the row is expanded each time it is pressed', async () => {
    render(<Toggling expandable />);
    const toggle = screen.getByRole('button', {
      name: 'Uploads retry in the request',
    });

    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers no button when there is nothing more to show', () => {
    render(<Toggling expandable={false} />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('Uploads retry in the request')).toBeVisible();
  });
});
