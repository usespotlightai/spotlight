import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { InferenceEndpointRequired } from '@/components/shared/InferenceEndpointRequired';

describe('InferenceEndpointRequired', () => {
  it('says what is off and why, and links everyone to the Inference settings', () => {
    render(
      <MemoryRouter>
        <InferenceEndpointRequired slug="acme">
          The judge is off.
        </InferenceEndpointRequired>
      </MemoryRouter>,
    );

    expect(
      document.querySelector('[data-slot="inference-endpoint-required"]'),
    ).toHaveTextContent(
      'The judge is off. This workspace has no inference endpoint.',
    );
    expect(
      screen.getByRole('link', { name: 'Set up inference' }),
    ).toHaveAttribute('href', '/w/acme/settings/general#inference');
  });
});
