// Smaller copies of a canvas for previews and thumbnails (keeps memory use low).
export function scaledCopy(src: HTMLCanvasElement, width: number): string {
  const height = Math.max(1, Math.round((src.height * width) / src.width));
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  out.getContext('2d')!.drawImage(src, 0, 0, width, height);
  return out.toDataURL('image/jpeg', 0.9);
}
