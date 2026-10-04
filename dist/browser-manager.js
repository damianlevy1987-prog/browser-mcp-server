import { chromium, firefox } from 'playwright';
import { antiDetection } from './anti-detection.js';
import { proxyManager } from './proxy-manager.js';
import { configManager } from './config-manager.js';
// Tor browser uses a custom Chromium build with Tor-specific settings
const TOR_CHROMIUM_ARGS = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-web-security',
];
class BrowserManager {
    sessions = new Map();
    browsers = new Map();
    contexts = new Map();
    pages = new Map();
    sessionCounter = 0;
    async launch(config) {
        const sessionId = `session-${++this.sessionCounter}`;
        console.error(`[browser-mcp] Launching ${config.name} in ${config.mode} mode (session: ${sessionId})`);
        let browser;
        const contextArgs = {
            viewport: config.viewport,
            ignoreHTTPSErrors: config.ignoreHTTPSErrors ?? false,
            bypassCSP: config.bypassCSP ?? false,
            locale: config.locale,
            userAgent: config.userAgent,
        };
        // Apply proxy if configured
        if (config.proxy) {
            contextArgs.proxy = config.proxy;
        }
        else if (configManager.getConfig().proxy.enabled) {
            // Auto-select proxy
            const proxy = proxyManager.getRandomProxy();
            if (proxy) {
                contextArgs.proxy = proxyManager.getPlaywrightProxy(proxy);
                console.error(`[browser-mcp][launch] Using proxy: ${proxy.ip}:${proxy.port}`);
            }
        }
        try {
            switch (config.name) {
                case 'firefox': {
                    browser = await firefox.launch({
                        headless: config.mode === 'headless',
                        args: config.args,
                    });
                    break;
                }
                case 'chromium': {
                    browser = await chromium.launch({
                        headless: config.mode === 'headless',
                        args: config.args,
                    });
                    break;
                }
                case 'edge': {
                    const edgeChannel = process.platform === 'win32' ? 'msedge' : process.platform === 'darwin' ? 'chrome-canary' : undefined;
                    browser = await chromium.launch({
                        headless: config.mode === 'headless',
                        channel: edgeChannel,
                        args: config.args,
                    });
                    break;
                }
                case 'safari': {
                    if (process.platform !== 'darwin') {
                        throw new Error('Safari is only available on macOS');
                    }
                    const webkit = (await import('playwright')).webkit;
                    browser = await webkit.launch({
                        headless: config.mode === 'headless',
                        args: config.args,
                    });
                    break;
                }
                case 'tor': {
                    browser = await firefox.launch({
                        headless: config.mode === 'headless',
                        args: [...(config.args || []), ...TOR_CHROMIUM_ARGS],
                    });
                    break;
                }
                default:
                    throw new Error(`Unknown browser: ${config.name}`);
            }
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to launch ${config.name}: ${errorMsg}`);
        }
        this.browsers.set(sessionId, browser);
        // Create context with anti-detection settings for privacy-focused browsers
        if (config.name === 'tor' || config.name === 'safari') {
            contextArgs.permissions = [];
            contextArgs.recordVideo = undefined;
        }
        const context = await browser.newContext(contextArgs);
        this.contexts.set(sessionId, context);
        const page = await context.newPage();
        this.pages.set(sessionId, page);
        // Collect console messages
        page.on('console', (msg) => {
            console.error(`[browser-mcp][${sessionId}] console[${msg.type()}]: ${msg.text()}`);
        });
        page.on('pageerror', (err) => {
            console.error(`[browser-mcp][${sessionId}] pageError: ${err.message}`);
        });
        // Apply anti-detection measures
        if (configManager.getConfig().antiDetection.enabled) {
            await antiDetection.apply(page, context, sessionId);
        }
        const session = {
            id: sessionId,
            browserName: config.name,
            mode: config.mode,
            state: 'idle',
            cookies: [],
            localStorage: {},
        };
        this.sessions.set(sessionId, session);
        return session;
    }
    async navigate(sessionId, url) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        const session = this.sessions.get(sessionId);
        if (session)
            session.state = 'navigating';
        try {
            const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
            const result = {
                url: page.url(),
                title: await page.title(),
            };
            if (session) {
                session.currentUrl = result.url;
                session.state = 'idle';
            }
            return result;
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            if (session)
                session.state = 'idle';
            return { url: page.url(), title: await page.title() };
        }
    }
    async screenshot(sessionId, options) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        const buffer = await page.screenshot({
            fullPage: options?.fullPage ?? false,
            type: 'png',
        });
        const info = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
        return {
            data: buffer.toString('base64'),
            width: info.w,
            height: info.h,
        };
    }
    async evaluate(sessionId, expression) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        return page.evaluate(expression);
    }
    async getText(sessionId, selector) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        const text = await page.textContent(selector);
        return text ?? '';
    }
    async click(sessionId, selector) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        await page.click(selector);
    }
    async fill(sessionId, selector, value) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        await page.fill(selector, value);
        // Add human-like delay after typing
        if (configManager.getConfig().antiDetection.enabled) {
            await antiDetection.delay(100, 300);
        }
    }
    async getCookies(sessionId) {
        const context = this.contexts.get(sessionId);
        if (!context)
            throw new Error(`Session ${sessionId} not found`);
        return context.cookies();
    }
    async setCookies(sessionId, cookies) {
        const context = this.contexts.get(sessionId);
        if (!context)
            throw new Error(`Session ${sessionId} not found`);
        await context.addCookies(cookies);
    }
    async getLocalStorage(sessionId) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        return page.evaluate(() => {
            const result = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key)
                    result[key] = localStorage.getItem(key) ?? '';
            }
            return result;
        });
    }
    async clearStorage(sessionId) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        await page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
    }
    async getPageCount(sessionId) {
        const context = this.contexts.get(sessionId);
        if (!context)
            throw new Error(`Session ${sessionId} not found`);
        return context.pages().length;
    }
    async newTab(sessionId) {
        const context = this.contexts.get(sessionId);
        if (!context)
            throw new Error(`Session ${sessionId} not found`);
        return context.newPage();
    }
    async closePage(sessionId) {
        const context = this.contexts.get(sessionId);
        if (!context)
            throw new Error(`Session ${sessionId} not found`);
        const pages = context.pages();
        if (pages.length > 1) {
            await pages[pages.length - 1].close();
        }
    }
    async getSource(sessionId) {
        const page = this.pages.get(sessionId);
        if (!page)
            throw new Error(`Session ${sessionId} not found`);
        return page.content();
    }
    async getHeaders(sessionId) {
        return {
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        };
    }
    async checkAvailability() {
        const results = [];
        // Check Firefox
        try {
            const tempBrowser = await firefox.launch({ headless: true, timeout: 5000 });
            const version = (tempBrowser.version() ?? '').split('.').slice(0, 2).join('.');
            await tempBrowser.close();
            results.push({ name: 'firefox', available: true, version, installed: true });
        }
        catch {
            results.push({ name: 'firefox', available: false, installed: false });
        }
        // Check Chromium
        try {
            const tempBrowser = await chromium.launch({ headless: true, timeout: 5000 });
            const version = (tempBrowser.version() ?? '').split('.').slice(0, 2).join('.');
            await tempBrowser.close();
            results.push({ name: 'chromium', available: true, version, installed: true });
        }
        catch {
            results.push({ name: 'chromium', available: false, installed: false });
        }
        // Check Edge
        try {
            const tempBrowser = await chromium.launch({ headless: true, channel: 'msedge', timeout: 5000 });
            const version = (tempBrowser.version() ?? '').split('.').slice(0, 2).join('.');
            await tempBrowser.close();
            results.push({ name: 'edge', available: true, version, installed: true });
        }
        catch {
            results.push({ name: 'edge', available: false, installed: false });
        }
        // Check Safari (macOS only)
        if (process.platform === 'darwin') {
            const webkit = (await import('playwright')).webkit;
            try {
                const tempBrowser = await webkit.launch({ headless: true, timeout: 5000 });
                const version = (tempBrowser.version() ?? '').split('.').slice(0, 2).join('.');
                await tempBrowser.close();
                results.push({ name: 'safari', available: true, version, installed: true });
            }
            catch {
                results.push({ name: 'safari', available: false, installed: false });
            }
        }
        else {
            results.push({ name: 'safari', available: false, installed: false, version: 'macOS-only' });
        }
        // Check Tor
        results.push({ name: 'tor', available: true, version: 'uses-firefox-engine', installed: true });
        return results;
    }
    async closeSession(sessionId) {
        const page = this.pages.get(sessionId);
        const context = this.contexts.get(sessionId);
        const browser = this.browsers.get(sessionId);
        if (page) {
            try {
                await page.close();
            }
            catch { /* ignore */ }
            this.pages.delete(sessionId);
        }
        if (context) {
            try {
                await context.close();
            }
            catch { /* ignore */ }
            this.contexts.delete(sessionId);
        }
        if (browser) {
            try {
                await browser.close();
            }
            catch { /* ignore */ }
            this.browsers.delete(sessionId);
        }
        this.sessions.delete(sessionId);
        antiDetection.clearActive();
    }
    async closeAll() {
        const ids = Array.from(this.sessions.keys());
        for (const id of ids) {
            await this.closeSession(id);
        }
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    listSessions() {
        return Array.from(this.sessions.values()).map((s) => ({
            id: s.id,
            browserName: s.browserName,
            mode: s.mode,
            state: s.state,
            currentUrl: s.currentUrl,
        }));
    }
}
export const browserManager = new BrowserManager();
