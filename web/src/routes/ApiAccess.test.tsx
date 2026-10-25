import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiAccess } from '@/routes/ApiAccess';

const listed = vi.fn();
const failing = vi.fn();
const refetch = vi.fn();
const workspace = vi.fn();
const requested = vi.fn();
const create = vi.fn();
const revoke = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: workspace() }),
}));

const trustsRequested = vi.fn();

vi.mock('@/hooks/api/useOidcTrusts', () => ({
  useOidcTrusts: (slug: string | undefined) => {
    trustsRequested(slug);

    return {
      data: [],
      isPending: false,
      errorUpdateCount: 0,
      isFetching: false,
      refetch: vi.fn(),
    };
  },
}));

vi.mock('@/hooks/api/useWorkspaceTokens', () => ({
  tokenKeys: { forWorkspace: (id?: string) => ['workspace-tokens', id] },
  useWorkspaceTokens: (workspaceId: string | undefined) => {
    requested(workspaceId);

    return {
      data: listed(),
      isPending: listed() === undefined,
      errorUpdateCount: failing() ? 1 : 0,
      isFetching: false,
      refetch,
    };
  },
}));

vi.mock('@/hooks/api/useCreateWorkspaceToken', async (actual) => ({
  ...(await actual<typeof import('@/hooks/api/useCreateWorkspaceToken')>()),
  useCreateWorkspaceToken: () => ({
    mutate: create,
    reset: vi.fn(),
    isPending: false,
    isError: false,
  }),
}));

vi.mock('@/hooks/api/useRevokeWorkspaceToken', () => ({
  useRevokeWorkspaceToken: () => ({
    mutate: revoke,
    reset: vi.fn(),
    isPending: false,
  }),
}));

const token = (over: Record<string, unknown> = {}) => ({
  id: 'token_1',
  version: 2,
  address: 'terraform',
  warnings: [],
  workspaceId: 'workspace_acme',
  name: 'terraform',
  description: 'Applies the platform repository from CI',
  scopes: ['configure', 'secrets'],
  issuedBy: 'user_1',
  issuedAt: '2026-08-20T09:00:00.000Z',
  expiresAt: null,
  ...over,
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/w/acme/settings/api-access']}>
      <Routes>
        <Route path="/w/:slug" element={<p>the workspace</p>} />
        <Route path="/w/:slug/settings/api-access" element={<ApiAccess />} />
      </Routes>
    </MemoryRouter>,
  );

const openCreate = async () => {
  const person = userEvent.setup();
  renderPage();
  await person.click(screen.getByRole('button', { name: 'Create token' }));

  return { person, dialog: await screen.findByRole('dialog') };
};

describe('ApiAccess', () => {
  beforeEach(() => {
    listed.mockReturnValue([]);
    failing.mockReturnValue(false);
    workspace.mockReturnValue({ id: 'workspace_acme', role: 'owner' });
    for (const each of [refetch, requested, create, revoke]) {
      each.mockClear();
    }
  });

  it('keeps the shape of a token while they load, keeping what never changes', () => {
    listed.mockReturnValue(undefined);

    renderPage();

    expect(
      screen.getByRole('status', { name: 'Loading the tokens' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Workspace tokens' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No workspace tokens/)).not.toBeInTheDocument();
  });

  it('says the tokens could not be loaded, and tries again on request', async () => {
    const person = userEvent.setup();
    listed.mockReturnValue(undefined);
    failing.mockReturnValue(true);

    renderPage();

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Tokens could not be loaded.',
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetch).toHaveBeenCalled();
  });

  it('says there are no tokens, leaving creating one to the section’s own button', async () => {
    const person = userEvent.setup();

    renderPage();

    expect(screen.getByText(/No workspace tokens/)).toBeInTheDocument();

    expect(
      screen.queryByRole('button', { name: 'Create the first token' }),
    ).not.toBeInTheDocument();

    await person.click(screen.getByRole('button', { name: 'Create token' }));

    expect(await screen.findByRole('dialog')).toHaveTextContent(
      'Create a token',
    );
  });

  it('counts the tokens beside the section’s name, and says of each when it was made, when it expires and what it may do', () => {
    listed.mockReturnValue([
      token(),
      token({
        id: 'token_2',
        name: 'plans',
        description: '',
        scopes: ['plan'],
        expiresAt: '2099-01-15T12:00:00.000Z',
      }),
    ]);

    renderPage();

    expect(
      screen.getByRole('heading', { name: /^Workspace tokens\s*2$/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('terraform')).toBeInTheDocument();
    expect(
      screen.queryByText('Applies the platform repository from CI'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/^Created .* · No expiry · Configure, Secrets$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^Created .* · Expires .*2099 · Plan$/),
    ).toBeInTheDocument();
  });

  it('sends a member back to the workspace, requesting no tokens and no OIDC trusts', () => {
    workspace.mockReturnValue({ id: 'workspace_acme', role: 'member' });

    renderPage();

    expect(screen.getByText('the workspace')).toBeInTheDocument();
    expect(requested).not.toHaveBeenCalledWith('workspace_acme');
    expect(trustsRequested).not.toHaveBeenCalledWith('acme');
  });

  it('creates a token that configures and expires, unless told otherwise', async () => {
    const { person, dialog } = await openCreate();

    await person.type(within(dialog).getByLabelText('Name'), 'Terraform CI');
    await person.click(
      within(dialog).getByRole('button', { name: 'Create token' }),
    );

    expect(create).toHaveBeenCalledWith(
      {
        name: 'terraform-ci',
        description: '',
        scopes: ['configure'],
        expiresAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      },
      expect.anything(),
    );
  });

  it('creates a token with the level and the grants chosen beside it', async () => {
    const { person, dialog } = await openCreate();

    await person.type(within(dialog).getByLabelText('Name'), 'reader');
    await person.type(
      within(dialog).getByLabelText(/What it is for/),
      '  Reads secrets  ',
    );
    await person.click(within(dialog).getByRole('radio', { name: /^Read/ }));
    await person.click(
      within(dialog).getByRole('checkbox', { name: /^Secrets/ }),
    );
    await person.click(
      within(dialog).getByRole('button', { name: 'Create token' }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'reader',
        description: 'Reads secrets',
        scopes: ['read', 'secrets'],
      }),
      expect.anything(),
    );
  });

  it('creates no token without a name', async () => {
    const { dialog } = await openCreate();

    expect(
      within(dialog).getByRole('button', { name: 'Create token' }),
    ).toBeDisabled();
  });

  it('shows a new token once, to copy, until the person says it is copied', async () => {
    create.mockImplementation((_spec, { onSuccess }) =>
      onSuccess({ name: 'terraform', token: 'token_secret' }),
    );
    const { person, dialog } = await openCreate();

    await person.type(within(dialog).getByLabelText('Name'), 'terraform');
    await person.click(
      within(dialog).getByRole('button', { name: 'Create token' }),
    );

    const shown = await screen.findByRole('region', {
      name: 'The terraform token',
    });
    expect(shown).toHaveTextContent('token_secret');
    expect(shown).toHaveTextContent('Spotlight shows this token only once');
    expect(
      within(shown).getByRole('button', { name: 'Copy token' }),
    ).toBeInTheDocument();

    await person.click(
      within(shown).getByRole('button', { name: 'I’ve copied it' }),
    );

    expect(screen.queryByText('token_secret')).not.toBeInTheDocument();
  });

  it('revokes a token only once the person confirms', async () => {
    const person = userEvent.setup();
    listed.mockReturnValue([token()]);

    renderPage();

    await person.click(
      screen.getByRole('button', { name: 'Actions for terraform' }),
    );
    await person.click(
      await screen.findByRole('menuitem', { name: 'Revoke token' }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('Revoke terraform?');
    expect(revoke).not.toHaveBeenCalled();

    await person.click(
      within(dialog).getByRole('button', { name: 'Revoke token' }),
    );

    expect(revoke).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'token_1', version: 2 }),
      expect.anything(),
    );
  });

  it('keeps a token the person decides to keep', async () => {
    const person = userEvent.setup();
    listed.mockReturnValue([token()]);

    renderPage();

    await person.click(
      screen.getByRole('button', { name: 'Actions for terraform' }),
    );
    await person.click(
      await screen.findByRole('menuitem', { name: 'Revoke token' }),
    );
    await person.click(
      within(await screen.findByRole('dialog')).getByRole('button', {
        name: 'Keep it',
      }),
    );

    expect(revoke).not.toHaveBeenCalled();
  });
});
