import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it } from 'vitest';
import { AttachmentTiles } from '@/components/shared/attachment/AttachmentTiles';
import type { Attachment } from '@/lib/attachment';

const showing = (attachments: Attachment[]) =>
  render(
    <MemoryRouter initialEntries={['/w/acme/team/team_1/tasks/task_1']}>
      <Routes>
        <Route
          path="/w/:slug/team/:teamId/tasks/:taskId"
          element={<AttachmentTiles attachments={attachments} />}
        />
      </Routes>
    </MemoryRouter>,
  );

describe('AttachmentTiles', () => {
  it('fills its square with a picture, opening the whole of it', () => {
    showing([
      { id: 'att_1', name: 'shot.png', contentType: 'image/png', size: 2048 },
    ]);

    expect(screen.getByRole('img', { name: 'shot.png' })).toHaveAttribute(
      'src',
      '/api/workspaces/acme/attachments/att_1',
    );
    expect(screen.getByRole('link', { name: 'shot.png' })).toHaveAttribute(
      'href',
      '/api/workspaces/acme/attachments/att_1',
    );
  });

  it('says what any other file is, and offers it to download', () => {
    showing([
      {
        id: 'att_2',
        name: 'Invoice-0001.pdf',
        contentType: 'application/pdf',
        size: 31_744,
      },
    ]);

    expect(
      screen.getByRole('link', { name: 'Invoice-0001.pdf' }),
    ).toHaveAttribute(
      'href',
      '/api/workspaces/acme/attachments/att_2?download=1',
    );
    expect(screen.getByText('pdf')).toBeInTheDocument();
    expect(screen.getByText('31 KB')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('names a file that goes by no extension at all', () => {
    showing([
      { id: 'att_3', name: 'notes', contentType: 'text/plain', size: 12 },
    ]);

    expect(screen.getByText('plain')).toBeInTheDocument();
  });

  it('shows nothing where nothing was attached', () => {
    showing([]);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });
});
