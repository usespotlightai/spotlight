import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { AnswerFailed } from '@/components/features/changes/AnswerFailed';
import { withSentRequest } from '@/lib/request-failure';

const unset = vi.hoisted(() => ({ value: false }));

vi.mock('@/hooks/useInferenceUnset', () => ({
  useInferenceUnset: () => unset.value,
}));

const failedWith = (status: number) =>
  withSentRequest(
    {},
    { status } as Response,
    new Request('http://localhost/answers', { method: 'POST' }),
  );

const shown = (error: unknown) =>
  render(
    <MemoryRouter initialEntries={['/acme']}>
      <Routes>
        <Route path="/:slug" element={<AnswerFailed error={error} />} />
      </Routes>
    </MemoryRouter>,
  );

describe('AnswerFailed', () => {
  it('says to add credits, and links to the endpoint, when the credits ran out', () => {
    unset.value = false;
    shown(failedWith(402));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Sorry, the inference endpoint has no credits left. Please add credits at your provider.',
    );
    expect(
      screen.getByRole('link', { name: 'Check endpoint' }),
    ).toHaveAttribute('href', '/w/acme/settings/inference');
  });

  it('asks to try again after any other failure', () => {
    unset.value = false;
    shown(failedWith(502));

    expect(screen.getByRole('alert').textContent).toContain('Please try again');
  });

  it('asks for an inference endpoint when none is set', () => {
    unset.value = true;
    shown(failedWith(502));

    expect(screen.getByText(/Answer grading is off\./)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Set up inference' }),
    ).toHaveAttribute('href', '/w/acme/settings/inference');
  });
});
