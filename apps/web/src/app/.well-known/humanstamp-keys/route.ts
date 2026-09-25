import { NextResponse } from 'next/server';
import { getKnownPublicKeys } from '@/lib/keys';

/**
 * GET /.well-known/humanstamp-keys
 * 
 * Expose server's known public keys for third-party verification.
 * This endpoint allows external verifiers to validate stamps without
 * trusting the public key stored in each stamp.
 */
export async function GET() {
  try {
    const keys = await getKnownPublicKeys();
    
    return NextResponse.json({
      version: 1,
      keys: keys.map(k => ({
        keyId: k.keyId,
        publicKey: k.publicKey,
        algorithm: 'Ed25519',
      })),
      note: 'These are the only keys trusted by this server for stamp verification.',
    }, {
      headers: {
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error fetching public keys:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
