export function calculateAutoScrollVelocity({
  edgeSize,
  fingerY,
  maximumSpeed,
  viewportHeight,
  viewportTop,
}: {
  edgeSize: number;
  fingerY: number;
  maximumSpeed: number;
  viewportHeight: number;
  viewportTop: number;
}) {
  'worklet';

  if (edgeSize <= 0 || maximumSpeed <= 0 || viewportHeight <= 0) {
    return 0;
  }

  const viewportBottom = viewportTop + viewportHeight;

  if (fingerY < viewportTop + edgeSize) {
    const proximity = Math.min(1, Math.max(0, (viewportTop + edgeSize - fingerY) / edgeSize));
    return -maximumSpeed * proximity;
  }

  if (fingerY > viewportBottom - edgeSize) {
    const proximity = Math.min(1, Math.max(0, (fingerY - (viewportBottom - edgeSize)) / edgeSize));
    return maximumSpeed * proximity;
  }

  return 0;
}
