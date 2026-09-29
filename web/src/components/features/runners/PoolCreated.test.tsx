import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PoolCreated } from '@/components/features/runners/PoolCreated';

describe('PoolCreated', () => {
  it('gives the install command with the token, and puts focus on copying it', () => {
    render(<PoolCreated pool="my-computer" token="spt_secret" />);

    expect(screen.getByText(/SPOTLIGHT_TOKEN=spt_secret/)).toBeInTheDocument();
    expect(screen.getByText(/my-computer pool/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Copy command' })).toHaveFocus();
  });
});
