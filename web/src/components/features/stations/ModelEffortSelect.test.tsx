import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModelEffortSelect } from '@/components/features/stations/ModelEffortSelect';

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'cursor',
        name: 'Cursor CLI',
        models: [{ id: 'grok-4.6', name: 'Cursor Grok 4.6' }],
        efforts: ['low', 'high'],
      },
      { id: 'plain', name: 'Plain', models: [], efforts: [] },
    ],
  }),
}));

const showing = (
  over: { harness?: string; model?: string; effort?: string } = {},
) => {
  const onModel = vi.fn();
  const onEffort = vi.fn();

  render(
    <ModelEffortSelect
      harness={over.harness ?? 'cursor'}
      model={over.model ?? ''}
      onModel={onModel}
      effort={over.effort ?? ''}
      onEffort={onEffort}
    />,
  );

  return { onModel, onEffort };
};

const trigger = () => screen.getByRole('button', { name: 'Model and effort' });

describe('ModelEffortSelect', () => {
  it('shows the chosen model and effort together', () => {
    showing({ model: 'grok-4.6', effort: 'high' });

    expect(trigger()).toHaveTextContent('Cursor Grok 4.6');
    expect(trigger()).toHaveTextContent('high');
  });

  it('shows just Default when neither is chosen', () => {
    showing();

    expect(trigger()).toHaveTextContent(/^Default$/);
  });

  it('shows the default model beside a chosen effort', () => {
    showing({ effort: 'high' });

    expect(trigger()).toHaveTextContent('Default model');
    expect(trigger()).toHaveTextContent('high');
  });

  it('chooses an effort from its own list', async () => {
    const user = userEvent.setup();
    const { onEffort } = showing();

    await user.click(trigger());
    await user.click(await screen.findByRole('menuitem', { name: /Effort/ }));
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'high' }));

    expect(onEffort).toHaveBeenCalledWith('high');
  });

  it('chooses a model from its own list', async () => {
    const user = userEvent.setup();
    const { onModel } = showing({ effort: 'low' });

    await user.click(trigger());
    await user.click(await screen.findByRole('menuitem', { name: /Model/ }));
    fireEvent.click(
      await screen.findByRole('menuitemradio', { name: 'Cursor Grok 4.6' }),
    );

    expect(onModel).toHaveBeenCalledWith('grok-4.6');
  });

  it('cannot be opened for a harness with no models or efforts', () => {
    showing({ harness: 'plain' });

    expect(trigger()).toBeDisabled();
  });
});
