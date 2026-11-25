/**
 * Low-light help for the camera: measuring how bright a frame is, and brightening a dim one so the face detector can
 * find a face in it.
 *
 * <p>The face detector was trained mostly on well-lit photos. In an ordinary room, or with the light behind the
 * candidate, a face is dark and flat; it scored under the detector's threshold and the candidate was warned that no
 * face could be seen while sitting in front of the camera. A dim frame is stretched to use the full range and lifted
 * with a gamma curve, which brings the face back without washing out a frame that is already bright.</p>
 */

/** Mean brightness, 0–255, under which a frame is treated as dim and brightened. */
export const DIM_FRAME_LUMA = 105;

/** The mean brightness a dim frame is lifted towards. */
const TARGET_LUMA = 135;

/** Longest edge of the frame worked on: enough for the detector, and cheap to process every few seconds. */
const WORK_EDGE = 640;

const luma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

function drawFrame(video: HTMLVideoElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const scale = Math.min(1, WORK_EDGE / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return { canvas, ctx };
}

/** Mean brightness of the pixels, 0–255. */
function meanLuma(data: Uint8ClampedArray): number {
  let sum = 0;
  let count = 0;
  // Every fourth pixel is plenty for an average.
  for (let i = 0; i < data.length; i += 16) {
    sum += luma(data[i], data[i + 1], data[i + 2]);
    count += 1;
  }
  return count ? sum / count : 0;
}

/**
 * Brightens image data in place: stretches the 1st–99th percentile of brightness to the full range (contrast), then
 * applies a gamma curve that moves the mean towards {@link TARGET_LUMA}. Returns the mean it started from.
 */
export function brightenImageData(image: ImageData): number {
  const { data } = image;
  const mean = meanLuma(data);
  if (mean >= DIM_FRAME_LUMA) return mean;

  // Brightness histogram, for the stretch.
  const histogram = new Uint32Array(256);
  let samples = 0;
  for (let i = 0; i < data.length; i += 16) {
    histogram[Math.round(luma(data[i], data[i + 1], data[i + 2]))] += 1;
    samples += 1;
  }
  const percentile = (p: number) => {
    let seen = 0;
    for (let v = 0; v < 256; v += 1) {
      seen += histogram[v];
      if (seen >= samples * p) return v;
    }
    return 255;
  };
  const low = percentile(0.01);
  const high = Math.max(low + 32, percentile(0.99)); // never stretch a near-flat frame into noise

  const stretchedMean = Math.min(250, Math.max(5, ((mean - low) / (high - low)) * 255));
  // gamma < 1 brightens; kept within a range that lifts shadows without turning noise into a face.
  const gamma = Math.min(1, Math.max(0.45, Math.log(TARGET_LUMA / 255) / Math.log(stretchedMean / 255)));

  const table = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v += 1) {
    const stretched = Math.min(1, Math.max(0, (v - low) / (high - low)));
    table[v] = Math.round(255 * Math.pow(stretched, gamma));
  }
  for (let i = 0; i < data.length; i += 4) {
    data[i] = table[data[i]];
    data[i + 1] = table[data[i + 1]];
    data[i + 2] = table[data[i + 2]];
  }
  return mean;
}

/**
 * The current video frame, brightened when it is dim, on a canvas the detector can read. Null when the video has no
 * frame yet. {@code dim} says whether it needed brightening.
 */
export function enhancedFrame(video: HTMLVideoElement): { canvas: HTMLCanvasElement; dim: boolean } | null {
  const frame = drawFrame(video);
  if (!frame) return null;
  const { canvas, ctx } = frame;
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const mean = brightenImageData(image);
  const dim = mean < DIM_FRAME_LUMA;
  if (dim) ctx.putImageData(image, 0, 0);
  return { canvas, dim };
}
