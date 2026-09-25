import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';

const execAsync = promisify(exec);

const getFfmpegPath = (): string => {
  try {
    return require('ffmpeg-static') as string;
  } catch {
    return 'ffmpeg';
  }
};

export type LabelCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface BurnLabelOptions {
  labelText: string;
  corner: LabelCorner;
  durationSeconds?: number;
}

function getPositionString(corner: LabelCorner): string {
  const padding = 20;
  switch (corner) {
    case 'top-left':
      return `x=${padding}:y=${padding}`;
    case 'top-right':
      return `x=w-tw-${padding}:y=${padding}`;
    case 'bottom-left':
      return `x=${padding}:y=h-th-${padding}`;
    case 'bottom-right':
      return `x=w-tw-${padding}:y=h-th-${padding}`;
  }
}

async function createLabelImage(text: string, corner: LabelCorner): Promise<Buffer> {
  const padding = 10;
  const fontSize = 24;
  const textWidth = Math.ceil(text.length * fontSize * 0.6);
  const textHeight = fontSize + padding * 2;

  const bgColor = { r: 0, g: 0, b: 0, alpha: 0.7 };
  
  const svg = `
    <svg width="${textWidth}" height="${textHeight}">
      <rect width="${textWidth}" height="${textHeight}" fill="rgb(${bgColor.r},${bgColor.g},${bgColor.b})" fill-opacity="${bgColor.alpha}"/>
      <text x="${padding}" y="${fontSize + padding / 2}" font-family="Arial, sans-serif" font-size="${fontSize}" fill="white">${text}</text>
    </svg>
  `;

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer();
}

function getOverlayPosition(corner: LabelCorner): string {
  const padding = 20;
  switch (corner) {
    case 'top-left':
      return `${padding}:${padding}`;
    case 'top-right':
      return `W-w-${padding}:${padding}`;
    case 'bottom-left':
      return `${padding}:H-h-${padding}`;
    case 'bottom-right':
      return `W-w-${padding}:H-h-${padding}`;
  }
}

export async function burnLabel(
  inputBuffer: Buffer,
  options: BurnLabelOptions
): Promise<Buffer> {
  const tmpDir = tmpdir();
  const timestamp = Date.now();
  const inputPath = join(tmpDir, `input-${timestamp}.mp4`);
  const overlayPath = join(tmpDir, `overlay-${timestamp}.png`);
  const outputPath = join(tmpDir, `output-${timestamp}.mp4`);

  writeFileSync(inputPath, inputBuffer);

  try {
    const labelImage = await createLabelImage(options.labelText, options.corner);
    writeFileSync(overlayPath, labelImage);

    const position = getOverlayPosition(options.corner);
    let filterString = `overlay=${position}`;

    if (options.durationSeconds) {
      filterString += `:enable='lt(t,${options.durationSeconds})'`;
    }

    const ffmpegPath = getFfmpegPath();
    const ffmpegCmd = `"${ffmpegPath}" -i "${inputPath}" -i "${overlayPath}" -filter_complex "${filterString}" -c:a copy -c:v libx264 -preset fast "${outputPath}"`;

    await execAsync(ffmpegCmd);

    const outputBuffer = readFileSync(outputPath);
    return outputBuffer;
  } finally {
    try {
      unlinkSync(inputPath);
    } catch {}
    try {
      unlinkSync(overlayPath);
    } catch {}
    try {
      unlinkSync(outputPath);
    } catch {}
  }
}
