import { NextRequest, NextResponse } from 'next/server';
import { nanoid } from 'nanoid';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { 
  hashFile, 
  verify, 
  createReceiptPayload,
  computeVideoFingerprint,
  compareFingerprints,
  VerifyMatchType 
} from '@human-stamp/core';
import { prisma } from '@/lib/prisma';
import { getKnownPublicKeys } from '@/lib/keys';

/**
 * POST /api/verify
 * Verify a video file by upload
 * - Try exact SHA-256 match first
 * - Fall back to fingerprint soft match if available
 * - Return match type and similarity score
 */
export async function POST(request: NextRequest) {
  let tempFilePath: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const sha256 = hashFile(buffer);

    // Try exact SHA-256 match first
    let stamp = await prisma.stamp.findFirst({
      where: { sha256 },
    });

    if (stamp) {
      // Exact match found
      const recipe = JSON.parse(stamp.recipeJson);
      const storedFingerprint = stamp.fingerprint ? JSON.parse(stamp.fingerprint) : undefined;
      const payload = createReceiptPayload(stamp.id, stamp.sha256, stamp.recipeJson, stamp.createdAtIso, storedFingerprint);
      
      // Verify using server's known public keys (not the key stored with stamp)
      const knownKeys = await getKnownPublicKeys();
      const matchingKey = knownKeys.find(k => k.keyId === stamp.keyId);
      const signatureValid = matchingKey 
        ? await verify(payload, stamp.signature, matchingKey.publicKey)
        : false;

      return NextResponse.json({
        found: true,
        matchType: 'exact' as VerifyMatchType,
        receipt: {
          id: stamp.id,
          sha256: stamp.sha256,
          recipe,
          createdAt: stamp.createdAtIso,
          signature: stamp.signature,
          publicKey: stamp.publicKey,
          fingerprint: stamp.fingerprint ? JSON.parse(stamp.fingerprint) : undefined,
        },
        signatureValid,
      });
    }

    // No exact match - try fingerprint soft match
    const isVideo = file.type.startsWith('video/') || 
                    file.name.match(/\.(mp4|mov|avi|mkv|webm)$/i);

    if (!isVideo) {
      return NextResponse.json({
        found: false,
        matchType: 'none' as VerifyMatchType,
      });
    }

    // Compute fingerprint of uploaded file
    let uploadedFingerprint: string[];
    try {
      tempFilePath = join(tmpdir(), `verify-${nanoid(8)}-${file.name}`);
      writeFileSync(tempFilePath, buffer);
      uploadedFingerprint = await computeVideoFingerprint(tempFilePath, 8);
    } catch (error) {
      console.error('Failed to compute fingerprint:', error);
      return NextResponse.json({
        found: false,
        matchType: 'none' as VerifyMatchType,
        error: 'Could not process video file',
      });
    } finally {
      if (tempFilePath) {
        try {
          unlinkSync(tempFilePath);
        } catch {}
      }
    }

    // Find stamps with fingerprints and compare
    const stampsWithFingerprints = await prisma.stamp.findMany({
      where: {
        fingerprint: { not: null },
      },
    });

    const SIMILARITY_THRESHOLD = 0.85;
    type StampType = Awaited<ReturnType<typeof prisma.stamp.findFirst>>;
    let bestMatch: StampType = null;
    let bestSimilarity = 0;

    for (const candidate of stampsWithFingerprints) {
      if (!candidate.fingerprint) continue;
      
      const storedFingerprint = JSON.parse(candidate.fingerprint);
      const similarity = compareFingerprints(uploadedFingerprint, storedFingerprint);

      if (similarity >= SIMILARITY_THRESHOLD && similarity > bestSimilarity) {
        bestMatch = candidate;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      const recipe = JSON.parse(bestMatch.recipeJson);
      const storedFingerprint = bestMatch.fingerprint ? JSON.parse(bestMatch.fingerprint) : undefined;
      const payload = createReceiptPayload(bestMatch.id, bestMatch.sha256, bestMatch.recipeJson, bestMatch.createdAtIso, storedFingerprint);
      
      // Verify using server's known public keys (not the key stored with stamp)
      const knownKeys = await getKnownPublicKeys();
      const matchingKey = knownKeys.find(k => k.keyId === bestMatch.keyId);
      const signatureValid = matchingKey 
        ? await verify(payload, bestMatch.signature, matchingKey.publicKey)
        : false;

      return NextResponse.json({
        found: true,
        matchType: 'fingerprint' as VerifyMatchType,
        similarity: bestSimilarity,
        receipt: {
          id: bestMatch.id,
          sha256: bestMatch.sha256,
          recipe,
          createdAt: bestMatch.createdAtIso,
          signature: bestMatch.signature,
          publicKey: bestMatch.publicKey,
          fingerprint: bestMatch.fingerprint ? JSON.parse(bestMatch.fingerprint) : undefined,
        },
        signatureValid,
      });
    }

    // No match found
    return NextResponse.json({
      found: false,
      matchType: 'none' as VerifyMatchType,
    });

  } catch (error) {
    console.error('Error verifying file:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
