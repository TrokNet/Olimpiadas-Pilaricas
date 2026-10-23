// Fits the complete composition including depth, pointer tilt and hover scale.
export function fitSceneDistance(aspect: number, selected = false) {
  const safeAspect = Math.max(0.3, aspect);
  return (
    Math.max(6.8, 2.65 / (Math.tan((20 * Math.PI) / 180) * safeAspect) + 0.6) +
    (selected ? -0.12 : 0)
  );
}
