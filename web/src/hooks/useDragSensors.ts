import {
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type SensorDescriptor,
  type SensorOptions,
} from '@dnd-kit/core';

const HOLD = 6;

const PRESS = { delay: 250, tolerance: 6 };

export function useDragSensors(): SensorDescriptor<SensorOptions>[] {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: HOLD } }),
    useSensor(TouchSensor, { activationConstraint: PRESS }),
  );
}
