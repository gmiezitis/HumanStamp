import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import { execSync } from 'child_process';

const BASE_URL = 'http://localhost:3000';
const ARTIFACTS_DIR = '/workspace/cloud-agent-artifacts/bc-15e53067-c0a6-5369-af8c-d2bd4a77eafe';

async function main() {
  console.log('\n=== Testing PDF Export and Evidence Pack ===\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // 1. Test PDF download
    console.log('1. Testing PDF download...');
    const pdfResponse = await page.request.get(`${BASE_URL}/api/receipts/cmukyx0ry000rrkva2r0p49qn/export?format=pdf`);
    if (pdfResponse.ok()) {
      const pdfBuffer = await pdfResponse.body();
      await mkdir(ARTIFACTS_DIR, { recursive: true });
      await writeFile(`${ARTIFACTS_DIR}/receipt.pdf`, pdfBuffer);
      console.log(`   ✓ PDF downloaded (${pdfBuffer.length} bytes)`);

      // Convert first page to PNG using ImageMagick if available
      try {
        execSync(`convert -density 150 "${ARTIFACTS_DIR}/receipt.pdf[0]" "${ARTIFACTS_DIR}/10-pdf-first-page.png"`, {
          stdio: 'ignore'
        });
        console.log('   ✓ PDF first page converted to PNG');
      } catch (e) {
        console.log('   ⚠ ImageMagick not available, cannot convert PDF to PNG');
      }
    } else {
      console.log(`   ✗ PDF download failed: ${pdfResponse.status()}`);
    }

    // 2. Test evidence pack download
    console.log('\n2. Testing evidence pack download...');
    const evidenceResponse = await page.request.get(`${BASE_URL}/api/receipts/cmukyx0ry000rrkva2r0p49qn/evidence-pack`);
    if (evidenceResponse.ok()) {
      const evidenceBuffer = await evidenceResponse.body();
      await writeFile(`${ARTIFACTS_DIR}/evidence-pack.zip`, evidenceBuffer);
      console.log(`   ✓ Evidence pack downloaded (${evidenceBuffer.length} bytes)`);

      // List zip contents
      try {
        const zipContents = execSync(`unzip -l "${ARTIFACTS_DIR}/evidence-pack.zip"`, { encoding: 'utf-8' });
        console.log('\n   Evidence pack contents:');
        console.log(zipContents);
      } catch (e) {
        console.log('   ⚠ Could not list zip contents');
      }
    } else {
      console.log(`   ✗ Evidence pack download failed: ${evidenceResponse.status()}`);
    }

    // 3. Test JSON export
    console.log('3. Testing JSON export...');
    const jsonResponse = await page.request.get(`${BASE_URL}/api/receipts/cmukyx0ry000rrkva2r0p49qn/export?format=json`);
    if (jsonResponse.ok()) {
      const jsonData = await jsonResponse.json();
      console.log(`   ✓ JSON export successful`);
      console.log(`   Signature: ${jsonData.signature?.substring(0, 32)}...`);
      console.log(`   Public key: ${jsonData.publicKey?.substring(0, 32)}...`);
    } else {
      console.log(`   ✗ JSON export failed: ${jsonResponse.status()}`);
    }

    console.log('\n=== PDF and Evidence Pack Tests Complete ===\n');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
