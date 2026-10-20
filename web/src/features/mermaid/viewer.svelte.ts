export const viewer = $state<{ open: boolean; source: string }>({
  open: false,
  source: "",
});

export function openViewer(source: string): void {
  viewer.source = source;
  viewer.open = true;
}

export function closeViewer(): void {
  viewer.open = false;
}
