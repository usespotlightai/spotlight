import { createContext, useContext } from 'react';

export const SectionLevel = createContext<2 | 3>(2);

export const useCardLevel = (): 2 | 3 => useContext(SectionLevel);
