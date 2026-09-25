import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export default async function globalSetup() {
  const testVideosDir = join(__dirname, '../test-videos');
  mkdirSync(testVideosDir, { recursive: true });

  console.log('Generating test videos...');

  // Generate v1: blue video with "Version 1" text for 5 seconds
  const v1Path = join(testVideosDir, 'test-v1.mp4');
  execSync(
    `ffmpeg -y -f lavfi -i color=c=blue:s=640x480:d=5 ` +
    `-vf "drawtext=text='Version 1 - Human Made':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2" ` +
    `-c:v libx264 -preset ultrafast -pix_fmt yuv420p "${v1Path}"`,
    { stdio: 'ignore' }
  );

  // Generate v2: similar but with changes at 2-4 seconds (red background)
  const v2Path = join(testVideosDir, 'test-v2.mp4');
  execSync(
    `ffmpeg -y -f lavfi -i color=c=blue:s=640x480:d=2 -f lavfi -i color=c=red:s=640x480:d=2 -f lavfi -i color=c=blue:s=640x480:d=1 ` +
    `-filter_complex "[0:v]drawtext=text='Version 2':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2[v0];` +
    `[1:v]drawtext=text='CHANGED':fontsize=40:fontcolor=yellow:x=(w-text_w)/2:y=(h-text_h)/2[v1];` +
    `[2:v]drawtext=text='Version 2':fontsize=40:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2[v2];` +
    `[v0][v1][v2]concat=n=3:v=1:a=0[out]" -map "[out]" ` +
    `-c:v libx264 -preset ultrafast -pix_fmt yuv420p "${v2Path}"`,
    { stdio: 'ignore' }
  );

  console.log('Test videos generated successfully');
  console.log(`v1: ${v1Path}`);
  console.log(`v2: ${v2Path}`);
}
