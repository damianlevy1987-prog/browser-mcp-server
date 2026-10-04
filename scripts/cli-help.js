#!/usr/bin/env node

/**
 * CLI Help Handler
 * Displays usage information when no arguments or --help is provided
 */

const HELP_TEXT = `
@browser-mcp/server - Browser Automation MCP Server
===================================================

Usage:
  browser-mcp [mode] [port]

Modes:
  sse    Start SSE server (default)
  http   Start HTTP server with StreamableHTTP
  stdio  Start via stdin/stdout (for MCP clients)
  help   Show this help message

Options:
  port   Port number (default: 3100)
  --help Show this help message

Examples:
  browser-mcp                    # Start SSE on port 3100
  browser-mcp sse 8080          # Start SSE on port 8080
  browser-mcp http              # Start HTTP on port 3100
  browser-mcp --help            # Show help

Endpoints:
  GET  /health      Health check
  POST /mcp         Streamable HTTP endpoint
  GET  /sse         SSE connection
  POST /messages    Legacy message endpoint

Supported Browsers:
  Firefox, Chromium, Edge, Safari (macOS), Tor

Launch Modes:
  Headed (with GUI)
  Headless (no GUI)

Features:
  • Anti-detection system
  • Phone verification bypass
  • Proxy management
  • Account tracking & auto-save

Configuration:
  See config/config.json for settings
  See config/secure.json for API keys/passwords

Install Playwright browsers:
  npx playwright install firefox chromium
`;

console.log(HELP_TEXT);
process.exit(0);
