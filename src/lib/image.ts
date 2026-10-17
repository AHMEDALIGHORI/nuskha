// Phone photos are often 3 to 8 MB, and Vercel rejects request bodies over 4.5 MB.
// Shrink to a size that still keeps handwriting legible before uploading.

const MAX_SIDE = 1600;
const QUALITY = 0.85;

export async function photoToDataUrl(file: File): Promise<string> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.toDataURL("image/jpeg", QUALITY);
  } catch {
    // Formats the browser cannot decode (some HEIC files) go up unchanged.
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
}
