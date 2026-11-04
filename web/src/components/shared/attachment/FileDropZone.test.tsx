import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FileDropZone } from '@/components/shared/attachment/FileDropZone';
import { type TakeFiles, useFileDropTarget } from '@/hooks/useFileDropTarget';

function Composer({ take }: { take: TakeFiles | null }) {
  useFileDropTarget(take);
  return <p>Composer</p>;
}

const carrying = (files: File[]) => ({
  dataTransfer: { types: ['Files'], files, items: [] },
});

const zone = (take: TakeFiles | null) =>
  render(
    <FileDropZone>
      <p>Thread</p>
      <Composer take={take} />
    </FileDropZone>,
  );

const indicator = () =>
  document.querySelector('[data-slot="file-drop-indicator"]');

describe('FileDropZone', () => {
  it('shows where to drop while files are dragged over the page', () => {
    zone(vi.fn());
    const thread = screen.getByText('Thread');

    fireEvent.dragEnter(thread, carrying([]));
    expect(indicator()).toBeInTheDocument();

    fireEvent.dragLeave(thread, carrying([]));
    expect(indicator()).not.toBeInTheDocument();
  });

  it('gives files dropped anywhere on the page to the composer', () => {
    const take = vi.fn();
    zone(take);
    const file = new File(['x'], 'shot.png', { type: 'image/png' });
    const thread = screen.getByText('Thread');

    fireEvent.dragEnter(thread, carrying([file]));
    fireEvent.drop(thread, carrying([file]));

    expect(take).toHaveBeenCalledWith([file]);
    expect(indicator()).not.toBeInTheDocument();
  });

  it('shows nothing when no composer takes files', () => {
    zone(null);

    fireEvent.dragEnter(screen.getByText('Thread'), carrying([]));

    expect(indicator()).not.toBeInTheDocument();
  });

  it('ignores a drag that carries no files', () => {
    zone(vi.fn());

    fireEvent.dragEnter(screen.getByText('Thread'), {
      dataTransfer: { types: ['text/plain'] },
    });

    expect(indicator()).not.toBeInTheDocument();
  });
});
