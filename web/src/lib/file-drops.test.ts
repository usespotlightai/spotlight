import { afterEach, describe, expect, it } from 'vitest';
import { refuseStrayFileDrops } from '@/lib/file-drops';

const dragged = (type: string, types: string[]) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { types, dropEffect: 'copy' },
  });
  return event as DragEvent;
};

describe('refuseStrayFileDrops', () => {
  let stop = () => {};

  afterEach(() => stop());

  it('stops a file dropped outside a drop target from opening in the browser', () => {
    stop = refuseStrayFileDrops();

    const over = dragged('dragover', ['Files']);
    const drop = dragged('drop', ['Files']);
    document.body.dispatchEvent(over);
    document.body.dispatchEvent(drop);

    expect(over.defaultPrevented).toBe(true);
    expect(over.dataTransfer?.dropEffect).toBe('none');
    expect(drop.defaultPrevented).toBe(true);
  });

  it('leaves a drag of text alone', () => {
    stop = refuseStrayFileDrops();

    const drop = dragged('drop', ['text/plain']);
    document.body.dispatchEvent(drop);

    expect(drop.defaultPrevented).toBe(false);
  });

  it('leaves the drop effect of a drop target that took the files', () => {
    stop = refuseStrayFileDrops();

    const over = dragged('dragover', ['Files']);
    document.body.addEventListener(
      'dragover',
      (event) => event.preventDefault(),
      {
        once: true,
      },
    );
    document.body.dispatchEvent(over);

    expect(over.dataTransfer?.dropEffect).toBe('copy');
  });
});
