export async function downloadImage(
  imageUrl: string,
  filename: string,
): Promise<void> {
  const res = await fetch(imageUrl);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(objectUrl);
}

export function copyImageUrl(imageUrl: string): Promise<void> {
  return navigator.clipboard.writeText(
    new URL(imageUrl, window.location.origin).toString(),
  );
}
