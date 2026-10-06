import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkspaceGeneral } from '@/routes/WorkspaceGeneral';

const workspace = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({
    data: workspace(),
    isPending: workspace() === undefined,
    errorUpdateCount: failing() ? 1 : 0,
    isFetching: false,
    refetch,
  }),
}));

const exportWorkspace = vi.fn();
vi.mock('@/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/api')>()),
  exportWorkspace: (options: unknown) => exportWorkspace(options),
}));

const saveFile = vi.fn();
vi.mock('@/lib/download', () => ({
  saveFile: (blob: Blob, name: string) => saveFile(blob, name),
}));

const showing = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/w/acme-inc/settings/general']}>
        <Routes>
          <Route
            path="/w/:slug/settings/general"
            element={<WorkspaceGeneral />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  workspace.mockReturnValue({
    id: 'ws_1',
    name: 'Acme Inc.',
    slug: 'acme-inc',
  });
  failing.mockReturnValue(false);
  refetch.mockClear();
  exportWorkspace.mockReset();
  saveFile.mockReset();
});

describe('WorkspaceGeneral', () => {
  it('names the workspace and where it lives', () => {
    showing();

    expect(
      screen.getByRole('heading', { level: 1, name: 'General' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acme Inc.')).toBeVisible();
    expect(screen.getByText('usespotlight.ai/w/acme-inc')).toBeVisible();
  });

  it('holds the place of the name while the workspace loads', () => {
    workspace.mockReturnValue(undefined);

    showing();

    expect(
      screen.getByRole('status', { name: 'Loading the workspace name' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download' })).toBeDisabled();
  });

  it('says the settings could not be loaded, and tries again when asked', async () => {
    workspace.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    showing();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'The workspace’s settings could not be loaded.',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('downloads the workspace as a Terraform module', async () => {
    exportWorkspace.mockResolvedValue({
      data: { files: [{ path: 'main.tf', content: '' }] },
    });
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    await waitFor(() =>
      expect(saveFile).toHaveBeenCalledWith(
        expect.any(Blob),
        'acme-inc-terraform.zip',
      ),
    );
    expect(exportWorkspace).toHaveBeenCalledWith(
      expect.objectContaining({ path: { id: 'ws_1' } }),
    );
  });

  it('offers to try again when the download fails', async () => {
    exportWorkspace.mockRejectedValueOnce(new Error('offline'));
    showing();

    await userEvent.click(screen.getByRole('button', { name: 'Download' }));

    const retry = screen.getByRole('button', { name: 'Download' });
    await waitFor(() => expect(retry).toBeEnabled());
    expect(saveFile).not.toHaveBeenCalled();

    exportWorkspace.mockResolvedValue({ data: { files: [] } });
    await userEvent.click(retry);

    await waitFor(() => expect(saveFile).toHaveBeenCalledOnce());
  });
});
