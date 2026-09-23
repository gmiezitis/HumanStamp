import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { hashFile, sign, createReceiptPayload, StampRecipe, computeVideoFingerprint } from '@human-stamp/core';
import { prisma } from '@/lib/prisma';
import { getSigningKeys } from '@/lib/keys';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const recipeInput = formData.get('recipe') as string | null;

    if (!recipeInput) {
      return NextResponse.json({ error: 'Missing recipe' }, { status: 400 });
    }

    let recipe: StampRecipe;
    try {
      recipe = JSON.parse(recipeInput);
    } catch {
      return NextResponse.json({ error: 'Invalid recipe JSON' }, { status: 400 });
    }

    if (!recipe.mode || !recipe.approver) {
      return NextResponse.json({ error: 'Recipe must include mode and approver' }, { status: 400 });
    }

    let sha256: string;
    let fingerprint: string[] | null = null;
    let tempFilePath: string | null = null;

    if (file) {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      sha256 = hashFile(buffer);

      // For video files, compute fingerprint
      // Save to temp file for ffmpeg processing
      const isVideo = file.type.startsWith('video/') || 
                      file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);
      
      if (isVideo) {
        try {
          tempFilePath = join(tmpdir(), `stamp-${nanoid(8)}-${file.name}`);
          writeFileSync(tempFilePath, buffer);
          fingerprint = await computeVideoFingerprint(tempFilePath, 8);
        } catch (error) {
          console.warn('Failed to compute fingerprint:', error);
          // Continue without fingerprint - not critical for seal
        } finally {
          if (tempFilePath) {
            try {
              unlinkSync(tempFilePath);
            } catch {}
          }
        }
      }
    } else {
      const providedHash = formData.get('sha256') as string | null;
      if (!providedHash) {
        return NextResponse.json({ error: 'Either file or sha256 required' }, { status: 400 });
      }
      sha256 = providedHash;
    }

    const id = nanoid(12);
    const createdAt = new Date().toISOString();

    const { privateKey, publicKey } = await getSigningKeys();
    const recipeJson = JSON.stringify(recipe);
    const payload = createReceiptPayload(id, sha256, recipeJson, createdAt);
    const signature = await sign(payload, privateKey);

    await prisma.stamp.create({
      data: {
        id,
        sha256,
        fingerprint: fingerprint ? JSON.stringify(fingerprint) : null,
        recipeJson,
        createdAtIso: createdAt,
        mode: recipe.mode,
        tools: JSON.stringify(recipe.tools || []),
        agentRoles: recipe.agentRoles ? JSON.stringify(recipe.agentRoles) : null,
        approver: recipe.approver,
        signature,
        publicKey,
      },
    });

    return NextResponse.json({
      id,
      sha256,
      recipe,
      createdAt,
      signature,
      publicKey,
      fingerprint,
    });
  } catch (error) {
    console.error('Error creating stamp:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
