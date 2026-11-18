import { createContext, useContext } from 'react';

export type GalleryEntry = {
  id: string;
  src: string;
  name: string;
  button: HTMLButtonElement;
};

type GalleryContext = {
  openId: string | null;
  register: (entry: GalleryEntry) => void;
  unregister: (id: string) => void;
  open: (id: string) => void;
};

export const Gallery = createContext<GalleryContext | null>(null);

export const useImageGallery = () => useContext(Gallery);
