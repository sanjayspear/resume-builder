/*
 * Company logos: an uploaded file or an image URL is turned into a small PNG
 * (fits inside 100 x 100 px) stored as base64 text ("data:image/png;base64,...").
 *
 * Why always PNG?
 * - The PDF library can draw PNG/JPG but not SVG, so SVGs are converted.
 * - Drawing through a <canvas> strips anything that isn't pixels (SVG scripts,
 *   hidden metadata), so the stored logo is just a picture.
 * - A base64 PNG works offline and survives export/import of backups.
 */

export const LOGO_MAX_PX = 100;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/svg+xml"];
export const LOGO_ACCEPT = ".png,.jpg,.jpeg,.svg,image/png,image/jpeg,image/svg+xml";

/** An error whose message is written for the user. */
export class LogoError extends Error {}

export async function logoFromFile(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new LogoError("Please choose a PNG, JPG or SVG image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new LogoError("That image is larger than 5 MB. Please choose a smaller file.");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    return await rasterize(objectUrl, { isSvg: file.type === "image/svg+xml", remote: false });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function logoFromUrl(rawUrl: string): Promise<string> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new LogoError("Enter the full image address, starting with https://");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new LogoError("Enter the full image address, starting with https://");
  }
  return rasterize(url.href, { isSvg: /\.svg$/i.test(url.pathname), remote: true });
}

function loadImage(src: string, remote: boolean): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Ask the other website for permission to use its image (CORS).
    if (remote) img.crossOrigin = "anonymous";
    const timer = setTimeout(() => reject(new Error("timeout")), 15_000);
    img.onload = () => {
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      reject(new Error("load failed"));
    };
    img.src = src;
  });
}

async function rasterize(src: string, { isSvg, remote }: { isSvg: boolean; remote: boolean }): Promise<string> {
  let img: HTMLImageElement;
  try {
    img = await loadImage(src, remote);
  } catch {
    throw new LogoError(
      remote
        ? "Couldn't load an image from that address. The website may block other apps from using its images - download the logo and upload the file instead."
        : "That file couldn't be opened as an image.",
    );
  }

  // Some SVGs have no size of their own; treat them as square.
  let width = img.naturalWidth || LOGO_MAX_PX;
  let height = img.naturalHeight || LOGO_MAX_PX;
  // Shrink to fit 100 x 100. Vector SVGs are also enlarged to that size;
  // small photos are not enlarged (that would only make them blurry).
  const scale = isSvg ? LOGO_MAX_PX / Math.max(width, height) : Math.min(1, LOGO_MAX_PX / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new LogoError("Your browser couldn't process the image.");
  context.imageSmoothingQuality = "high";
  context.drawImage(img, 0, 0, width, height);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    // The browser refuses to read pixels from another site's image unless
    // that site allows it (CORS).
    throw new LogoError(
      "That website doesn't allow its images to be used in other apps. Download the logo and upload the file instead.",
    );
  }
}
