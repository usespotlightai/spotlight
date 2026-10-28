import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FixedRepositories } from '@/components/features/stations/FixedRepositories';

vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({ data: [] }),
}));

describe('FixedRepositories', () => {
  it('shows the repositories in a disabled selector that says why', () => {
    render(
      <FixedRepositories
        slug="acme"
        repositories={['acme/worker']}
        because="A chat keeps the repositories it started with."
      />,
    );

    const selector = screen.getByRole('button', { name: 'Repositories' });
    expect(selector).toBeDisabled();
    expect(selector).toHaveTextContent('acme/worker');
    expect(selector).toHaveAccessibleDescription(
      'A chat keeps the repositories it started with.',
    );
  });
});
