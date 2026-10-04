#!/usr/bin/env node

import { randomUUID } from 'node:crypto';
import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { tools } from './tools.js';
import { browserManager } from './browser-manager.js';
import { accountManager } from './account-manager.js';
import { configManager } from './config-manager.js';
import { proxyManager } from './proxy-manager.js';

// Handle CLI arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
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

Supported Browsers: Firefox, Chromium, Edge, Safari (macOS), Tor
Launch Modes: Headed, Headless

Features: Anti-detection, Phone verification, Proxy management, Account tracking
`);
  process.exit(0);
}

const SERVER_NAME = 'browser-mcp-server';
const SERVER_VERSION = '0.2.0';
const MODE = args[0] ?? 'sse';
const PORT = parseInt(args[1]) || 3100;
const HOST = '::';

// Initialize managers
accountManager.initialize();
configManager.initialize();

// Session management
const IDLE_MS = 30 * 60000;
const MAX_SESSIONS = 50;
interface SessionInfo {
  transport: SSEServerTransport | StreamableHTTPServerTransport;
  open: number;
  lastActive: number;
}
const sessions = new Map<string, SessionInfo>();

const trackResponse = (session: SessionInfo, res: express.Response) => {
  if (!res.socket || res.destroyed) return;
  session.open++;
  res.on('close', () => {
    session.open--;
    session.lastActive = Date.now();
  });
};

setInterval(() => {
  const cutoff = Date.now() - IDLE_MS;
  for (const { transport, open, lastActive } of sessions.values()) {
    if (open === 0 && lastActive < cutoff) {
      transport.close().catch(console.error);
    }
  }
}, 60000).unref();

// Create MCP Server with all tools registered
const createServer = () => {
  const mcpServer = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
  );

  for (const tool of tools) {
    mcpServer.registerTool(tool.name, {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }, tool.execute);
  }

  return mcpServer;
};

// Create Express app
const app = express();

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', server: SERVER_NAME, version: SERVER_VERSION, activeSessions: sessions.size, port: PORT });
});

// Root info
app.get('/', (_req, res) => {
  res.json({
    name: SERVER_NAME, version: SERVER_VERSION,
    description: 'Advanced MCP server for browser automation with anti-detection, phone verification, proxy management, and account tracking',
    endpoints: {
      streamableHttp: 'POST /mcp — Modern transport (recommended)',
      sse: 'GET /sse — Legacy SSE transport',
      messages: 'POST /messages?sessionId=<id> — Legacy message endpoint',
      health: 'GET /health — Health check',
    },
    supportedBrowsers: ['firefox', 'chromium', 'edge', 'safari', 'tor'],
    launchModes: ['headed', 'headless'],
    features: {
      antiDetection: {
        enabled: true,
        humanLikeTyping: true,
        sessionWarming: true,
        userAgentRotation: true,
        navigatorSpoofing: true,
      },
      phoneVerification: {
        enabled: false, // Disabled by default
        fiveSimIntegration: true,
        skipStrategies: true,
        autoRetry: true,
      },
      proxyManagement: {
        enabled: false,
        freeProxyFetching: true,
        automaticSelection: true,
        validation: true,
      },
      accountManagement: {
        autoSave: true,
        statistics: true,
        backupEnabled: true,
        exportFormats: ['json', 'csv'],
      },
      security: {
        secureConfigFiles: true,
        apiKeyManagement: true,
        passwordProtection: true,
      },
    },
    totalTools: tools.length,
  });
});

// ============================================================
// STREAMABLE HTTP TRANSPORT (Protocol version 2025-11-25)
// ============================================================
app.all('/mcp', async (req, res) => {
  console.log(`[browser-mcp] Streamable HTTP ${req.method} /mcp`);
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;
    let transport: StreamableHTTPServerTransport | undefined;

    if (session) {
      if (session.transport instanceof StreamableHTTPServerTransport) {
        transport = session.transport;
        trackResponse(session, res);
      } else {
        res.status(400).json({
          jsonrpc: '2.0', error: { code: -32000, message: 'Session uses incompatible transport' }, id: null,
        });
        return;
      }
    } else if (!sessionId && req.method === 'POST') {
      if (sessions.size >= MAX_SESSIONS) {
        res.status(503).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Too many open sessions' }, id: null });
        return;
      }
      const newSessionId = randomUUID();
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => newSessionId,
        onsessioninitialized: (sid: string) => {
          console.log(`[browser-mcp] StreamableHTTP session initialized: ${sid}`);
          sessions.set(sid, { transport: transport!, open: 0, lastActive: Date.now() });
        },
      });
      transport.onclose = () => {
        const sid = transport!.sessionId;
        if (sid) sessions.delete(sid);
      };
    } else if (sessionId) {
      res.status(404).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Session not found' }, id: null });
      return;
    } else {
      res.status(400).json({ jsonrpc: '2.0', error: { code: -32000, message: 'No valid session ID' }, id: null });
      return;
    }

    if (!transport) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Transport not available' }, id: null });
      return;
    }

    const server = createServer();
    await server.connect(transport);
    await transport.handleRequest(req, res);
  } catch (error) {
    console.error('[browser-mcp] Streamable HTTP error:', error);
    if (!res.headersSent) {
      res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  }
});

// ============================================================
// DEPRECATED HTTP+SSE TRANSPORT (Protocol version 2024-11-05)
// ============================================================
app.get('/sse', async (req, res) => {
  console.log('[browser-mcp] SSE client connecting...');
  if (sessions.size >= MAX_SESSIONS) {
    res.status(503).send('Too many open sessions');
    return;
  }
  const transport = new SSEServerTransport('/messages', res);
  const session: SessionInfo = { transport, open: 0, lastActive: Date.now() };
  sessions.set(transport.sessionId, session);
  trackResponse(session, res);
  transport.onclose = () => { sessions.delete(transport.sessionId); };
  const server = createServer();
  await server.connect(transport);
});

app.post('/messages', async (req, res) => {
  const sessionId = req.query.sessionId as string | undefined;
  const existing = sessionId ? sessions.get(sessionId)?.transport : undefined;
  if (existing instanceof SSEServerTransport) {
    await existing.handlePostMessage(req, res, req.body);
  } else {
    res.status(400).json({
      jsonrpc: '2.0', error: { code: -32000, message: 'Session uses incompatible transport' }, id: null,
    });
  }
});

// Start listening
const httpServer = app.listen(PORT, HOST, () => {
  console.error(`\n[browser-mcp] ${SERVER_NAME} v${SERVER_VERSION} running\n`);
  console.error(`[browser-mcp] Listening on [${HOST}] port ${PORT}\n`);
  console.error(`[browser-mcp] Endpoints:`);
  console.error(`[browser-mcp]   GET  http://[::]:${PORT}/          — API info`);
  console.error(`[browser-mcp]   GET  http://[::]:${PORT}/health  — Health check`);
  console.error(`[browser-mcp]   POST http://[::]:${PORT}/mcp     — Streamable HTTP (recommended)`);
  console.error(`[browser-mcp]   GET  http://[::]:${PORT}/sse     — SSE transport`);
  console.error(`[browser-mcp]   POST http://[::]:${PORT}/messages — Legacy messages\n`);
  console.error(`[browser-mcp] Supported browsers: firefox, chromium, edge, safari, tor`);
  console.error(`[browser-mcp] Launch modes: headed, headless`);
  console.error(`[browser-mcp] Total tools: ${tools.length}`);
  console.error(`[browser-mcp] Features: Anti-detection, Phone verification, Proxy management, Account tracking\n`);
});

process.on('SIGINT', async () => {
  console.error('[browser-mcp] Shutting down...');
  for (const [, { transport }] of sessions) { try { await transport.close(); } catch { /* ignore */ } }
  httpServer.close();
  await browserManager.closeAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[browser-mcp] Shutting down...');
  for (const [, { transport }] of sessions) { try { await transport.close(); } catch { /* ignore */ } }
  httpServer.close();
  await browserManager.closeAll();
  process.exit(0);
});
