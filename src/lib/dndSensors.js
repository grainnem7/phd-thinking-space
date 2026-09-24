import { PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';

// Mouse and pen only; touch goes through TouchSensor so a swipe still scrolls.
export class MousePointerSensor extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown',
    handler: ({ nativeEvent: event }, { onActivation }) => {
      if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return false;
      onActivation?.({ event });
      return true;
    },
  }];
}

// A mouse drags after moving 6px. A finger has to press and hold for 300ms
// (moving less than 8px) first, so swiping over draggable things scrolls.
export function useTouchFriendlySensors(keyboardOptions) {
  return useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, keyboardOptions),
  );
}
