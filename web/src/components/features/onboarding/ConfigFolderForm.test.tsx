import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigFolderForm } from '@/components/features/onboarding/ConfigFolderForm';

const started = vi.fn();
const starting = { isError: false, error: null as unknown };

vi.mock('@/hooks/api/useHarnesses', () => ({
  useHarnesses: () => ({
    data: [
      {
        id: 'claude-code',
        name: 'Claude Code',
        executable: 'claude-agent-acp',
        models: [],
        defaultModel: '',
        efforts: [],
        discovery: [],
      },
    ],
  }),
}));
vi.mock('@/hooks/api/useRepositories', () => ({
  useRepositories: () => ({
    data: [{ fullName: 'acme/api' }, { fullName: 'acme/infra' }],
  }),
}));
vi.mock('@/hooks/api/useStartChat', () => ({
  useStartChat: () => ({ mutate: started, isPending: false, ...starting }),
}));

const showing = () =>
  render(
    <MemoryRouter>
      <ConfigFolderForm slug="acme" teamId="team_1" />
    </MemoryRouter>,
  );

beforeEach(() => {
  started.mockReset();
  starting.isError = false;
  starting.error = null;
});

describe('ConfigFolderForm', () => {
  it('waits for a repository before it starts the setup chat', () => {
    showing();

    expect(
      screen.getByRole('button', { name: 'Start setup chat' }),
    ).toBeDisabled();
  });

  it('starts the setup chat in the folder chosen, reading the repositories chosen', async () => {
    const user = userEvent.setup();
    showing();

    await user.click(screen.getByRole('button', { name: /^Repository:/ }));
    await user.click(
      await screen.findByRole('menuitemradio', { name: 'acme/infra' }),
    );
    await user.clear(screen.getByRole('textbox', { name: 'Folder' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Folder' }),
      'infra/spotlight',
    );
    await user.click(screen.getByRole('button', { name: 'Repositories' }));
    await user.click(
      await screen.findByRole('menuitemcheckbox', { name: 'acme/api' }),
    );
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Start setup chat' }));

    expect(started).toHaveBeenCalledWith(
      expect.objectContaining({
        teamId: 'team_1',
        harness: 'claude-code',
        repositories: ['acme/api'],
        setup: { repository: 'acme/infra', folder: 'infra/spotlight' },
      }),
      expect.anything(),
    );
  });

  it('says why the setup chat could not start', () => {
    starting.isError = true;
    starting.error = {
      detail: 'Config folder must not contain . or .. parts.',
    };
    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Config folder must not contain . or .. parts.',
    );
  });
});
