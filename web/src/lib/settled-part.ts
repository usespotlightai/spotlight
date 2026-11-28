import { createContext } from 'react';

// True inside the card of a part of an inbox item that was resolved: what it
// still asks was left without an answer, and no longer waits for one. Its
// form stays, so it can still be answered.
export const SettledPartContext = createContext(false);

export const NOT_ANSWERED = 'Not answered';

export const NOT_DECIDED = 'Not decided';
