import { createContext, type ReactNode, use } from 'react';

const Flat = createContext(false);

export function FlatLists({ children }: { children: ReactNode }) {
  return <Flat value={true}>{children}</Flat>;
}

export const useFlatLists = (): boolean => use(Flat);
