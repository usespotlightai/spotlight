import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';

const HOLD = 6;

const PRESS = { delay: 250, tolerance: 6 };

export function useDragSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: HOLD } }),
    useSensor(TouchSensor, { activationConstraint: PRESS }),
  );
}
