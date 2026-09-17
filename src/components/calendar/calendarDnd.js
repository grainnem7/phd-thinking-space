import {
  PointerSensor, TouchSensor, KeyboardSensor, KeyboardCode, useSensor, useSensors, pointerWithin, closestCenter,
} from '@dnd-kit/core';
import { addDaysToKey } from '../../lib/recurrence';

// Drag-and-drop plumbing for moving calendar items between days.
// Droppables are month cells with id `day:YYYY-MM-DD` and data { date }.
// Draggables carry data { kind: 'entry', entry } or { kind: 'todo', todo }.

export const dayDropId = (dateKey) => `day:${dateKey}`;

// Events, deadlines and board task due dates can move; Google events are read-only.
export const canMoveEntry = (entry) => ['event', 'deadline', 'task'].includes(entry?.source);

// To-dos on days that have already passed stay put (they're a record of that day).
export const canDragTodo = (todo, todayKey) => Boolean(todo?.date) && todo.date >= todayKey;

// Mouse and pen only; touch goes through TouchSensor so a swipe still scrolls.
class MousePointerSensor extends PointerSensor {
  static activators = [{
    eventName: 'onPointerDown',
    handler: ({ nativeEvent: event }, { onActivation }) => {
      if (event.pointerType === 'touch' || !event.isPrimary || event.button !== 0) return false;
      onActivation?.({ event });
      return true;
    },
  }];
}

const OFFSETS = {
  [KeyboardCode.Left]: -1,
  [KeyboardCode.Right]: 1,
  [KeyboardCode.Up]: -7,
  [KeyboardCode.Down]: 7,
};

// Arrow keys jump the dragged item from day cell to day cell.
function dayCellCoordinates(event, { context, currentCoordinates }) {
  const offset = OFFSETS[event.code];
  if (offset === undefined) return undefined;
  event.preventDefault();
  const { over, active, droppableRects, collisionRect } = context;
  if (!collisionRect) return undefined;

  const from = centerInside(collisionRect, over && droppableRects.get(over.id)) ? over.data?.current?.date : null;
  const start = active?.data?.current?.date;
  const targetKey = from ? addDaysToKey(from, offset) : start;
  let rect = targetKey && droppableRects.get(dayDropId(targetKey));
  // Item's own day isn't on screen: start from the first visible day
  if (!rect && !from) rect = droppableRects.values().next().value;
  if (!rect) return undefined;

  return {
    x: currentCoordinates.x + (rect.left + rect.width / 2) - (collisionRect.left + collisionRect.width / 2),
    y: currentCoordinates.y + (rect.top + rect.height / 2) - (collisionRect.top + collisionRect.height / 2),
  };
}

export function useCalendarSensors() {
  return useSensors(
    useSensor(MousePointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: dayCellCoordinates }),
  );
}

function centerInside(rect, container) {
  if (!rect || !container) return false;
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return x >= container.left && x <= container.left + container.width && y >= container.top && y <= container.top + container.height;
}

// Pointer position when there is one (mouse/touch). Keyboard drags only count as over
// a day once the item sits on that cell, so dropping straight after pick-up does nothing.
export function dayCollision(args) {
  if (args.pointerCoordinates) return pointerWithin(args);
  return closestCenter(args)
    .filter(({ id }) => centerInside(args.collisionRect, args.droppableRects.get(id)))
    .slice(0, 1);
}
