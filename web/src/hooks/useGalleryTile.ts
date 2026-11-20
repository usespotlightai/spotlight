import { type RefObject, useId, useLayoutEffect } from 'react';

import { useImageGallery } from '@/components/shared/attachment/imageGalleryContext';

export function useGalleryTile(
  button: RefObject<HTMLButtonElement | null>,
  src: string,
  name: string,
) {
  const id = useId();
  const gallery = useImageGallery();
  const register = gallery?.register;
  const unregister = gallery?.unregister;

  useLayoutEffect(() => {
    if (button.current) {
      register?.({ id, src, name, button: button.current });
    }
  }, [button, id, src, name, register]);

  useLayoutEffect(() => () => unregister?.(id), [id, unregister]);

  return {
    shown: gallery?.openId === id,
    open: () => gallery?.open(id),
  };
}
