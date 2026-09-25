import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

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

export async function burnLabel(
  inputBuffer: Buffer,
  options: BurnLabelOptions
): Promise<Buffer> {
  const tmpDir = tmpdir();
  const inputPath = join(tmpDir, `input-${Date.now()}.mp4`);
  const outputPath = join(tmpDir, `output-${Date.now()}.mp4`);

  writeFileSync(inputPath, inputBuffer);

  try {
    const labelText = options.labelText;
    const position = getPositionString(options.corner);
    
    const fontsize = 24;
    const bgcolor = '0x000000@0.7';
    const fontcolor = 'white';
    const padding = 10;

    let filterString = `drawtext=text='${labelText}':fontsize=${fontsize}:fontcolor=${fontcolor}:box=1:boxcolor=${bgcolor}:boxborderw=${padding}:${position}`;

    if (options.durationSeconds) {
      filterString += `:enable='lt(t,${options.durationSeconds})'`;
    }

    const ffmpegCmd = `ffmpeg -i "${inputPath}" -vf "${filterString}" -c:a copy -c:v libx264 -preset fast "${outputPath}"`;

    await execAsync(ffmpegCmd);

    const outputBuffer = readFileSync(outputPath);
    return outputBuffer;
  } finally {
    try {
      unlinkSync(inputPath);
    } catch {}
    try {
      unlinkSync(outputPath);
    } catch {}
  }
}
