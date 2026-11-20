import { SKIP_OFF_SCREEN } from '@/lib/off-screen';

export const SKIPPED_OFF_SCREEN = `-mx-5 px-5 ${SKIP_OFF_SCREEN} [contain-intrinsic-block-size:auto_160px]`;

// The turns a thread shows when it opens skip nothing, so their real heights
// are known before the first paint and the thread opens at the right place.
export const SHOWN_FIRST = '-mx-5 px-5';

export const TURNS_SHOWN_FIRST = 3;
