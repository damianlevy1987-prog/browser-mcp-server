import fs from 'fs';
import path from 'path';
// User-Agent database for rotation
const USER_AGENTS = [
    // Chrome Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    // Chrome macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    // Firefox Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
    // Firefox macOS
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
    // Edge Windows
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0',
];
// Common names for realistic account creation
const NAMES_FILE = path.join(process.cwd(), 'data', 'names.txt');
const DEFAULT_CONFIG = {
    enabled: true,
    typingDelayMin: 100,
    typingDelayMax: 300,
    actionDelayMin: 500,
    actionDelayMax: 1200,
    sessionWarmingEnabled: true,
    warmupSites: ['https://www.google.com', 'https://www.bbc.com', 'https://www.wikipedia.org', 'https://www.youtube.com'],
    rotateUserAgent: true,
};
class AntiDetectionSystem {
    config;
    currentPage = null;
    context = null;
    currentSessionId = null;
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // Set active page and context for detection manipulation
    setActive(page, context, sessionId) {
        this.currentPage = page;
        this.context = context;
        this.currentSessionId = sessionId;
    }
    // Remove active reference
    clearActive() {
        this.currentPage = null;
        this.context = null;
        this.currentSessionId = null;
    }
    // Apply all anti-detection measures to a page
    async apply(page, context, sessionId) {
        if (!this.config.enabled)
            return;
        this.setActive(page, context, sessionId);
        try {
            // Modify navigator properties
            await this.hideAutomationSignatures(page);
            // Set random user agent if configured
            if (this.config.rotateUserAgent) {
                await this.applyRandomUserAgent(context);
            }
            // Add stealth scripts
            await this.applyStealthScripts(page);
            console.error(`[browser-mcp][anti-detect] Applied to session ${sessionId}`);
        }
        catch (err) {
            console.error(`[browser-mcp][anti-detect] Failed to apply:`, err);
        }
    }
    // Hide automation signatures
    async hideAutomationSignatures(page) {
        await page.evaluate(() => {
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => false,
            });
            // Mock plugins length
            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });
            // Mock languages
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });
            // Override chrome runtime
            window.chrome = {
                runtime: {
                    onMessage: {},
                    send: () => { },
                },
            };
            // Fake permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => parameters.name === 'notifications'
                ? Promise.resolve({ state: Notification['permission'] })
                : originalQuery(parameters);
            // WebGL vendor spoofing
            const getParameter = WebGLRenderingContext.prototype.getParameter;
            WebGLRenderingContext.prototype.getParameter = function (parameter) {
                if (parameter === 37445)
                    return 'Intel Inc.';
                if (parameter === 37446)
                    return 'Intel Iris OpenGL Engine';
                return getParameter.call(this, parameter);
            };
        }, { runAt: 'documentStart' });
    }
    // Apply random user agent (returns UA for use in context creation)
    getRandomUserAgent() {
        const uas = this.config.customUserAgents || USER_AGENTS;
        return uas[Math.floor(Math.random() * uas.length)];
    }
    // Apply random user agent to existing context (if supported)
    async applyRandomUserAgent(context) {
        const ua = this.getRandomUserAgent();
        console.error(`[browser-mcp][anti-detect] Selected UA: ${ua.substring(0, 50)}...`);
        // Note: Playwright doesn't support changing UA after context creation
        // This is a placeholder for future compatibility
    }
    // Apply additional stealth scripts
    async applyStealthScripts(page) {
        await page.addInitScript(() => {
            // Override toString methods to prevent detection
            const originalToString = Function.prototype.toString;
            Function.prototype.toString = function () {
                if (this.name === 'webdriverExecute') {
                    return 'function webdriverExecute() { [native code] }';
                }
                return originalToString.call(this);
            };
            // Mock console
            const originalLog = console.log;
            console.log = function (...args) {
                // Suppress automation-related logs
                if (args.some((a) => typeof a === 'string' && a.includes('automation'))) {
                    return;
                }
                return originalLog.apply(console, args);
            };
        });
    }
    // Simulate human-like typing
    async typeHumanely(selector, text, options) {
        if (!this.currentPage)
            throw new Error('No active page');
        const delayMin = options?.delayMin ?? this.config.typingDelayMin;
        const delayMax = options?.delayMax ?? this.config.typingDelayMax;
        await this.currentPage.fill(selector, text);
        // Add small pause after typing
        await this.delay(delayMin, delayMax);
    }
    // Natural delay between actions
    async delay(min, max) {
        const delayMin = min ?? this.config.actionDelayMin;
        const delayMax = max ?? this.config.actionDelayMax;
        const delay = delayMin + Math.random() * (delayMax - delayMin);
        await new Promise((resolve) => setTimeout(resolve, delay));
    }
    // Session warming - browse common sites to appear human
    async warmupSession(sessionId) {
        if (!this.config.sessionWarmingEnabled) {
            return { visited: [], errors: [] };
        }
        if (!this.currentPage)
            throw new Error('No active page');
        const visited = [];
        const errors = [];
        const sitesToVisit = this.config.warmupSites.slice(0, 2 + Math.floor(Math.random() * 2)); // Visit 2-3 sites
        for (const site of sitesToVisit) {
            try {
                await this.currentPage.goto(site, { waitUntil: 'domcontentloaded', timeout: 15000 });
                visited.push(site);
                await this.delay(1000, 3000); // Stay on each site for 1-3 seconds
            }
            catch (err) {
                errors.push(`${site}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        console.error(`[browser-mcp][anti-detect] Session warmed up: ${visited.length} sites visited`);
        return { visited, errors };
    }
    // Generate random name from file or default list
    async generateName() {
        const defaultNames = [
            'James Smith', 'Maria Garcia', 'Mohammed Ali', 'Sarah Johnson',
            'Chen Wei', 'Emma Brown', 'Carlos Rodriguez', 'Yuki Tanaka',
            'Olivia Wilson', 'Ahmed Hassan', 'Sophie Martin', 'Liam Davis',
            'Isabella Lopez', 'Noah Anderson', 'Mia Taylor', 'Ethan Thomas',
        ];
        // Try to load names from file
        try {
            const namesPath = this.config.namesFile || NAMES_FILE;
            if (fs.existsSync(namesPath)) {
                const content = fs.readFileSync(namesPath, 'utf-8');
                const names = content.split('\n').map((n) => n.trim()).filter(Boolean);
                if (names.length > 0) {
                    return names[Math.floor(Math.random() * names.length)];
                }
            }
        }
        catch {
            // Fall back to default names
        }
        return defaultNames[Math.floor(Math.random() * defaultNames.length)];
    }
    // Generate random birthday
    generateBirthday() {
        const year = 1960 + Math.floor(Math.random() * 45);
        const month = 1 + Math.floor(Math.random() * 12);
        const daysInMonth = new Date(year, month, 0).getDate();
        const day = 1 + Math.floor(Math.random() * daysInMonth);
        return { year, month, day };
    }
    // Get current configuration
    getConfig() {
        return { ...this.config };
    }
    // Update configuration
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
export const antiDetection = new AntiDetectionSystem();
