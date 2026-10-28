import { carriesFiles } from '@/lib/attachment';

const refuse = (event: DragEvent) => {
  if (event.defaultPrevented || !carriesFiles(event.dataTransfer)) {
    return;
  }

  event.preventDefault();
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'none';
  }
};

export const refuseStrayFileDrops = (target: Window = window) => {
  target.addEventListener('dragover', refuse);
  target.addEventListener('drop', refuse);

  return () => {
    target.removeEventListener('dragover', refuse);
    target.removeEventListener('drop', refuse);
  };
};
