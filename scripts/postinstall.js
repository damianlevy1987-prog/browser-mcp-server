#!/usr/bin/env node

/**
 * Post-install script for @browser-mcp/server
 * 
 * This script runs after `npm install` and handles:
 * 1. Checking if Playwright browsers are installed
 * 2. Offering to install missing browsers
 * 3. Setting up the environment
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const BROWSERS = ['firefox', 'chromium'];
const CACHE_DIR = join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.cache', 'ms-playwright');

function checkBrowserInstalled(browser) {
  const browserDirs = [
    join(CACHE_DIR, `${browser}-*`),
  ];
  
  try {
    const dirs = execSync(`ls -d ${CACHE_DIR}/${browser}-* 2>/dev/null || true`, { encoding: 'utf-8' }).trim();
    return dirs.length > 0;
  } catch {
    return false;
  }
}

function main() {
  console.log('\n🔧 @browser-mcp/server installed successfully!\n');
  
  // Check which browsers are available
  const missingBrowsers = [];
  for (const browser of BROWSERS) {
    if (!checkBrowserInstalled(browser)) {
      missingBrowsers.push(browser);
    }
  }
  
  if (missingBrowsers.length > 0) {
    console.log('⚠️  Missing browser binaries:');
    for (const browser of missingBrowsers) {
      console.log(`   - ${browser}`);
    }
    console.log('\n📦 Install browsers with one of these commands:\n');
    console.log('   # Install Firefox + Chromium (recommended):');
    console.log('   npx playwright install firefox chromium\n');
    console.log('   # Install all supported browsers:');
    console.log('   npx playwright install --with-deps\n');
    console.log('   # Or install manually:');
    console.log('   pip3 install playwright');
    console.log('   python3 -m playwright install firefox chromium\n');
    
    // Try to auto-install if in non-interactive mode
    if (process.env.NPM_CONFIG_YES || process.argv.includes('--yes')) {
      console.log('🔄 Auto-installing browsers...\n');
      try {
        execSync('npx playwright install firefox chromium', { 
          stdio: 'inherit',
          env: { ...process.env, PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0' }
        });
        console.log('\n✅ Browsers installed successfully!\n');
      } catch (err) {
        console.error('\n❌ Failed to auto-install browsers. Please run manually.\n');
      }
    }
  } else {
    console.log('✅ Browser binaries found!');
  }
  
  console.log('\n🚀 Quick start:\n');
  console.log('   # Start the MCP server:');
  console.log('   browser-mcp\n');
  console.log('   # Or with custom port:');
  console.log('   browser-mcp sse 3100\n');
  console.log('   # For Claude Desktop config, see README.md\n');
}

main();
