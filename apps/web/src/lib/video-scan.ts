import { Reader } from '@contentauth/c2pa-node';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

export interface C2PACredentials {
  found: boolean;
  generator?: string;
  actions?: string[];
  claimGeneratorInfo?: any[];
  raw?: any;
}

export interface FFProbeMetadata {
  encoder?: string;
  creation_time?: string;
  format?: string;
  duration?: number;
  tags?: Record<string, string>;
}

export interface VideoScanResult {
  c2pa: C2PACredentials;
  ffprobe: FFProbeMetadata;
  aiSignals: {
    fromC2PA: string[];
    fromMetadata: string[];
  };
}

export async function scanC2PA(buffer: Buffer): Promise<C2PACredentials> {
  try {
    const tmpPath = join(tmpdir(), `c2pa-${Date.now()}.mp4`);
    writeFileSync(tmpPath, buffer);

    try {
      const reader = await Reader.fromAsset({ path: tmpPath });
      
      if (!reader) {
        return { found: false };
      }

      const manifestStore = reader.json();
      const activeManifest = reader.getActive();

      if (!activeManifest) {
        return { found: false };
      }

      const claimGenerator = activeManifest.claim_generator;
      const actions = activeManifest.assertions
        ?.filter((a: any) => a['c2pa.actions'])
        ?.flatMap((a: any) => a['c2pa.actions']?.actions || [])
        ?.map((action: any) => action.action || action.softwareAgent || '')
        .filter(Boolean);

      return {
        found: true,
        generator: claimGenerator,
        actions: actions || [],
        claimGeneratorInfo: activeManifest.claim_generator_info,
        raw: manifestStore,
      };
    } finally {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error('C2PA scan error:', error);
    return { found: false };
  }
}

export async function scanFFProbe(buffer: Buffer): Promise<FFProbeMetadata> {
  try {
    const tmpPath = join(tmpdir(), `probe-${Date.now()}.mp4`);
    writeFileSync(tmpPath, buffer);

    try {
      const { stdout } = await execAsync(
        `ffprobe -v quiet -print_format json -show_format -show_streams "${tmpPath}"`
      );

      const data = JSON.parse(stdout);
      const format = data.format || {};
      const tags = format.tags || {};

      return {
        encoder: tags.encoder || data.streams?.[0]?.tags?.encoder,
        creation_time: tags.creation_time,
        format: format.format_name,
        duration: parseFloat(format.duration) || 0,
        tags,
      };
    } finally {
      try {
        unlinkSync(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  } catch (error) {
    console.error('ffprobe scan error:', error);
    return {};
  }
}

const AI_TOOL_KEYWORDS = [
  'sora', 'runway', 'pika', 'synthesia', 'gen-', 'stable diffusion',
  'midjourney', 'dall-e', 'firefly', 'kling', 'veo', 'openai',
];

function detectAIFromText(text: string): string[] {
  const lower = text.toLowerCase();
  return AI_TOOL_KEYWORDS.filter((keyword) => lower.includes(keyword));
}

export async function scanVideo(buffer: Buffer): Promise<VideoScanResult> {
  const [c2pa, ffprobe] = await Promise.all([
    scanC2PA(buffer),
    scanFFProbe(buffer),
  ]);

  const aiSignals: VideoScanResult['aiSignals'] = {
    fromC2PA: [],
    fromMetadata: [],
  };

  if (c2pa.found) {
    if (c2pa.generator) {
      const detected = detectAIFromText(c2pa.generator);
      aiSignals.fromC2PA.push(...detected);
    }
    if (c2pa.actions) {
      for (const action of c2pa.actions) {
        const detected = detectAIFromText(action);
        aiSignals.fromC2PA.push(...detected);
      }
    }
  }

  if (ffprobe.encoder) {
    const detected = detectAIFromText(ffprobe.encoder);
    aiSignals.fromMetadata.push(...detected);
  }

  if (ffprobe.tags) {
    for (const [key, value] of Object.entries(ffprobe.tags)) {
      const detected = detectAIFromText(`${key}:${value}`);
      aiSignals.fromMetadata.push(...detected);
    }
  }

  return {
    c2pa,
    ffprobe,
    aiSignals,
  };
}

export function detectMismatch(
  userClaim: string,
  scanResult: VideoScanResult
): { hasMismatch: boolean; reason?: string } {
  const allAISignals = [
    ...scanResult.aiSignals.fromC2PA,
    ...scanResult.aiSignals.fromMetadata,
  ];

  if (userClaim === 'human' && allAISignals.length > 0) {
    return {
      hasMismatch: true,
      reason: `File contains AI generation signals (${allAISignals.join(', ')}), but claim is 'human'`,
    };
  }

  if (userClaim === 'ai-generated' && scanResult.c2pa.found && !scanResult.aiSignals.fromC2PA.length) {
    return {
      hasMismatch: true,
      reason: "C2PA credentials present but don't indicate AI generation, yet claim is 'ai-generated'",
    };
  }

  return { hasMismatch: false };
}
