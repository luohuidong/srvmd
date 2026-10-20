export type ViewState = {
  width: number;
  height: number;
  scale: number;
  x: number;
  y: number;
};

export function clampScale(value: number): number {
  return Math.max(0.1, Math.min(8, value));
}

/** Center and scale a diagram inside the available viewport. */
export function fitState(
  width: number,
  height: number,
  viewportWidth: number,
  viewportHeight: number,
  padding = 36,
): ViewState {
  const safeWidth = Math.max(width, 1);
  const safeHeight = Math.max(height, 1);
  const availableWidth = Math.max(viewportWidth - padding * 2, 80);
  const availableHeight = Math.max(viewportHeight - padding * 2, 80);
  const scale = clampScale(Math.min(availableWidth / safeWidth, availableHeight / safeHeight, 1.5));

  return {
    width: safeWidth,
    height: safeHeight,
    scale,
    x: (viewportWidth - safeWidth * scale) / 2,
    y: (viewportHeight - safeHeight * scale) / 2,
  };
}

/** Zoom while keeping the point under the cursor stationary. */
export function zoomAt(state: ViewState, x: number, y: number, nextScale: number): ViewState {
  const scale = clampScale(nextScale);
  const ratio = scale / state.scale;

  return {
    ...state,
    scale,
    x: x - (x - state.x) * ratio,
    y: y - (y - state.y) * ratio,
  };
}

export function zoomBy(state: ViewState, viewportWidth: number, viewportHeight: number, factor: number): ViewState {
  return zoomAt(state, viewportWidth / 2, viewportHeight / 2, state.scale * factor);
}

export function panBy(state: ViewState, dx: number, dy: number): ViewState {
  return { ...state, x: state.x + dx, y: state.y + dy };
}
