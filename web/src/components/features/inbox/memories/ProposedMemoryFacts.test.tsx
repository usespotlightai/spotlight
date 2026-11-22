import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProposedMemoryFacts } from '@/components/features/inbox/memories/ProposedMemoryFacts';
import type { ProposedMemory } from '@/lib/memory';
import { scrollViewport, watchResizes } from '@/test/resize';

const MEMORY: ProposedMemory = {
  id: 'memory_1',
  kind: 'preference',
  body: 'Name branches after the ticket.',
  source: 'person',
  state: 'proposed',
  scope: 'team',
  repository: null,
  paths: [],
  supersedes: null,
  retires: null,
  editable: true,
  inactiveMemories: [],
  decision: null,
  harness: null,
  steps: [],
  notes: [],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ProposedMemoryFacts', () => {
  it('offers to show the whole memory when it is cut off', () => {
    const measure = watchResizes();
    const { container } = render(
      <ProposedMemoryFacts
        memory={MEMORY}
        editing={false}
        pending={false}
        body={MEMORY.body}
        bodyId="memory-body"
        onBody={() => {}}
      />,
    );
    measure(scrollViewport(container), {
      clientHeight: 128,
      scrollHeight: 400,
    });

    expect(
      screen.getByRole('button', { name: 'Show the whole memory' }),
    ).toHaveAttribute('aria-expanded', 'false');
  });
});
