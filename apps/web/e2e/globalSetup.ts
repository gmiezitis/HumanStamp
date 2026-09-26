import { execSync } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function globalSetup() {
  console.log('Generating test videos...');
  
  const testVideosDir = join(__dirname, 'test-videos');
  mkdirSync(testVideosDir, { recursive: true });

  const v1Path = join(testVideosDir, 'v1.mp4');
  const v2Path = join(testVideosDir, 'v2.mp4');

  console.log('Generating v1.mp4 (10s testsrc2)...');
  execSync(
    `ffmpeg -y -f lavfi -i testsrc2=duration=10:size=1280x720:rate=30 -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${v1Path}"`,
    { stdio: 'inherit' }
  );

  console.log('Generating v2.mp4 (same as v1, but seconds 4-6 replaced with different pattern)...');
  const tmpBeforePath = join(testVideosDir, 'tmp-before.mp4');
  const tmpMiddlePath = join(testVideosDir, 'tmp-middle.mp4');
  const tmpAfterPath = join(testVideosDir, 'tmp-after.mp4');

  execSync(
    `ffmpeg -y -f lavfi -i testsrc2=duration=4:size=1280x720:rate=30 -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${tmpBeforePath}"`,
    { stdio: 'inherit' }
  );

  execSync(
    `ffmpeg -y -f lavfi -i color=c=red:s=1280x720:d=2:rate=30 -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${tmpMiddlePath}"`,
    { stdio: 'inherit' }
  );

  execSync(
    `ffmpeg -y -f lavfi -i testsrc2=duration=4:size=1280x720:rate=30 -c:v libx264 -preset ultrafast -pix_fmt yuv420p "${tmpAfterPath}"`,
    { stdio: 'inherit' }
  );

  const concatFile = join(testVideosDir, 'concat.txt');
  writeFileSync(
    concatFile,
    `file '${tmpBeforePath}'\nfile '${tmpMiddlePath}'\nfile '${tmpAfterPath}'`
  );

  execSync(
    `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${v2Path}"`,
    { stdio: 'inherit' }
  );

  console.log('Test videos generated successfully');
}

export default globalSetup;
