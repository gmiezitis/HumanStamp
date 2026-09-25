#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { hashFile, StampRecipe } from '@human-stamp/core';

const program = new Command();

program
  .name('stamp')
  .description('Human Stamp CLI - seal videos with human-approval receipts')
  .version('0.1.0');

program
  .command('seal')
  .description('Seal a video file')
  .argument('<file>', 'Path to video file')
  .option('--mode <mode>', 'Stamp mode: human | human+ai | agent+human-approved', 'human')
  .option('--tools <tools>', 'Comma-separated list of tools used', '')
  .option('--approver <approver>', 'Human approver display name', 'Anonymous')
  .option('--agent-roles <roles>', 'Comma-separated list of agent roles (optional)', '')
  .option('--api <url>', 'API base URL', process.env.STAMP_API_URL || 'http://localhost:3000')
  .action(async (filePath: string, options) => {
    try {
      const resolvedPath = path.resolve(filePath);
      
      if (!fs.existsSync(resolvedPath)) {
        console.error(`Error: File not found: ${filePath}`);
        process.exit(1);
      }

      const fileBuffer = fs.readFileSync(resolvedPath);
      const sha256 = hashFile(fileBuffer);

      const recipe: StampRecipe = {
        mode: options.mode as any,
        tools: options.tools ? options.tools.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
        approver: options.approver,
      };

      if (options.agentRoles) {
        recipe.agentRoles = options.agentRoles.split(',').map((r: string) => r.trim()).filter(Boolean);
      }

      console.log('Sealing video...');
      console.log(`  File: ${path.basename(filePath)}`);
      console.log(`  SHA-256: ${sha256}`);
      console.log(`  Mode: ${recipe.mode}`);
      console.log(`  Tools: ${recipe.tools.join(', ') || 'none'}`);
      console.log(`  Approver: ${recipe.approver}`);

      const formData = new FormData();
      formData.append('file', fs.createReadStream(resolvedPath));
      formData.append('recipe', JSON.stringify(recipe));

      const apiUrl = `${options.api}/api/stamps`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`API error: ${response.status} ${error}`);
      }

      const result = await response.json();
      const verifyUrl = `${options.api}/r/${result.id}`;

      console.log('\n✓ Video sealed successfully!');
      console.log(`  Receipt ID: ${result.id}`);
      console.log(`  Verify URL: ${verifyUrl}`);
    } catch (error) {
      console.error('Error sealing video:', error);
      process.exit(1);
    }
  });

program.parse();
