import { z } from 'zod/v4';
import { browserManager } from './browser-manager.js';
import { antiDetection } from './anti-detection.js';
import { phoneVerification } from './phone-verification.js';
import { proxyManager } from './proxy-manager.js';
import { accountManager } from './account-manager.js';
import { configManager } from './config-manager.js';
const BROWSER_NAMES = ['firefox', 'chromium', 'edge', 'safari', 'tor'];
const LAUNCH_MODES = ['headed', 'headless'];
function latestSessionId(args) {
    if (args.session_id && typeof args.session_id === 'string')
        return args.session_id;
    const sessions = browserManager.listSessions();
    return sessions.at(-1)?.id;
}
// Wrap result in MCP content format
const ok = (data) => ({
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
});
export const tools = [
    // ===== BROWSER MANAGEMENT TOOLS =====
    // 1. Launch browser with advanced options
    {
        name: 'browser_launch',
        title: 'Launch Browser',
        description: 'Launch a browser instance with anti-detection, proxy, and session warming support.',
        inputSchema: z.object({
            browser: z.enum(BROWSER_NAMES).describe('Browser to launch'),
            mode: z.enum(LAUNCH_MODES).optional().describe('headed or headless').default('headless'),
            viewport_width: z.number().int().min(100).max(7680).optional().describe('Viewport width').default(1280),
            viewport_height: z.number().int().min(100).max(4320).optional().describe('Viewport height').default(720),
            user_agent: z.string().optional().describe('Custom User-Agent string'),
            locale: z.string().optional().describe('Locale e.g. "en-US"'),
            proxy_server: z.string().optional().describe('Proxy URL e.g. "http://ip:port"'),
            ignore_https_errors: z.boolean().optional().describe('Ignore HTTPS errors'),
            enable_anti_detection: z.boolean().optional().describe('Enable anti-detection measures').default(true),
            enable_warmup: z.boolean().optional().describe('Enable session warming').default(false),
        }),
        execute: async (args) => {
            const config = {
                name: args.browser,
                mode: args.mode || 'headless',
                viewport: { width: args.viewport_width, height: args.viewport_height },
            };
            if (args.user_agent)
                config.userAgent = args.user_agent;
            if (args.locale)
                config.locale = args.locale;
            if (args.ignore_https_errors)
                config.ignoreHTTPSErrors = true;
            if (args.proxy_server)
                config.proxy = { server: args.proxy_server };
            const session = await browserManager.launch(config);
            // Warmup session if enabled
            let warmupResult = null;
            if (args.enable_warmup && args.enable_anti_detection !== false) {
                try {
                    warmupResult = await antiDetection.warmupSession(session.id);
                }
                catch { /* ignore */ }
            }
            return ok({
                sessionId: session.id,
                browser: session.browserName,
                mode: session.mode,
                warmup: warmupResult,
            });
        },
    },
    // 2. Navigate
    {
        name: 'browser_navigate',
        title: 'Navigate To URL',
        description: 'Navigate the active page to a URL.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
            url: z.string().url().describe('URL to navigate to'),
            wait_until: z.enum(['domcontentloaded', 'load', 'networkidle']).optional().describe('Wait condition').default('networkidle'),
            timeout_ms: z.number().int().positive().optional().describe('Timeout ms').default(30000),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            const result = await browserManager.navigate(sid, args.url);
            return ok({ sessionId: sid, url: result.url, title: result.title });
        },
    },
    // 3. Screenshot
    {
        name: 'browser_screenshot',
        title: 'Take Screenshot',
        description: 'Take a screenshot of the current page.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
            full_page: z.boolean().optional().describe('Capture full page').default(false),
            selector: z.string().optional().describe('CSS selector for element capture'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            const result = await browserManager.screenshot(sid, { fullPage: args.full_page });
            return ok({ sessionId: sid, imageData: result.data, mimeType: 'image/png', width: result.width, height: result.height });
        },
    },
    // 4. Evaluate JS
    {
        name: 'browser_evaluate',
        title: 'Execute JavaScript',
        description: 'Execute JavaScript in the browser context.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
            expression: z.string().describe('JavaScript expression'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            const result = await browserManager.evaluate(sid, args.expression);
            return ok({ sessionId: sid, result });
        },
    },
    // 5. Get text
    {
        name: 'browser_get_text',
        title: 'Get Element Text',
        description: 'Get text content from an element.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
            selector: z.string().describe('CSS selector'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            const text = await browserManager.getText(sid, args.selector);
            return ok({ sessionId: sid, selector: args.selector, text });
        },
    },
    // 6. Click
    {
        name: 'browser_click',
        title: 'Click Element',
        description: 'Click an element with human-like delay.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
            selector: z.string().describe('CSS selector'),
            button: z.enum(['left', 'right', 'middle']).optional().describe('Mouse button').default('left'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            await browserManager.click(sid, args.selector);
            await antiDetection.delay(200, 500);
            return ok({ sessionId: sid, clicked: args.selector });
        },
    },
    // 7. Fill
    {
        name: 'browser_fill',
        title: 'Fill Input Field',
        description: 'Fill an input field with human-like typing simulation.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
            selector: z.string().describe('CSS selector'),
            value: z.string().describe('Value to fill'),
            typing_delay_min: z.number().int().min(0).optional().describe('Min typing delay ms').default(100),
            typing_delay_max: z.number().int().min(0).optional().describe('Max typing delay ms').default(300),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            await antiDetection.typeHumanely(args.selector, args.value, {
                delayMin: args.typing_delay_min,
                delayMax: args.typing_delay_max,
            });
            return ok({ sessionId: sid, selector: args.selector, value: args.value });
        },
    },
    // 8. Get cookies
    {
        name: 'browser_get_cookies',
        title: 'Get Cookies',
        description: 'Get all cookies for the current session.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            const cookies = await browserManager.getCookies(sid);
            return ok({ sessionId: sid, cookies });
        },
    },
    // 9. Set cookies
    {
        name: 'browser_set_cookies',
        title: 'Set Cookies',
        description: 'Set cookies in the browser context.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
            cookies_json: z.string().describe('JSON array of cookie objects'),
        }),
        execute: async (args) => {
            const sid = args.session_id;
            const cookies = JSON.parse(args.cookies_json);
            await browserManager.setCookies(sid, cookies);
            return ok({ sessionId: sid, setCount: cookies.length });
        },
    },
    // 10. Get localStorage
    {
        name: 'browser_get_local_storage',
        title: 'Get Local Storage',
        description: 'Read all localStorage entries.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            const storage = await browserManager.getLocalStorage(sid);
            return ok({ sessionId: sid, localStorage: storage });
        },
    },
    // 11. Clear storage
    {
        name: 'browser_clear_storage',
        title: 'Clear Storage',
        description: 'Clear all localStorage and sessionStorage.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            await browserManager.clearStorage(sid);
            return ok({ sessionId: sid, message: 'Storage cleared' });
        },
    },
    // 12. New tab
    {
        name: 'browser_new_tab',
        title: 'Open New Tab',
        description: 'Open a new tab in the browser.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
        }),
        execute: async (args) => {
            const sid = args.session_id;
            await browserManager.newTab(sid);
            const count = await browserManager.getPageCount(sid);
            return ok({ sessionId: sid, pageCount: count });
        },
    },
    // 13. Close tab
    {
        name: 'browser_close_tab',
        title: 'Close Tab',
        description: 'Close the last tab.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
        }),
        execute: async (args) => {
            const sid = args.session_id;
            await browserManager.closePage(sid);
            const count = await browserManager.getPageCount(sid);
            return ok({ sessionId: sid, pageCount: count });
        },
    },
    // 14. Get source
    {
        name: 'browser_get_source',
        title: 'Get Page Source',
        description: 'Get the full HTML source.',
        inputSchema: z.object({
            session_id: z.string().optional().describe('Session ID'),
        }),
        execute: async (args) => {
            const sid = args.session_id ?? latestSessionId(args);
            if (!sid)
                throw new Error('No active session.');
            const source = await browserManager.getSource(sid);
            return ok({ sessionId: sid, htmlLength: source.length, source });
        },
    },
    // 15. Check availability
    {
        name: 'browser_check_availability',
        title: 'Check Browser Availability',
        description: 'Check which browsers are available.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            const info = await browserManager.checkAvailability();
            return ok({ browsers: info });
        },
    },
    // 16. List sessions
    {
        name: 'browser_list_sessions',
        title: 'List Sessions',
        description: 'List all active browser sessions.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            const sess = browserManager.listSessions();
            return ok({ count: sess.length, sessions: sess });
        },
    },
    // 17. Close session
    {
        name: 'browser_close_session',
        title: 'Close Session',
        description: 'Close a specific browser session.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
        }),
        execute: async (args) => {
            const sid = args.session_id;
            await browserManager.closeSession(sid);
            return ok({ sessionId: sid, message: 'Session closed' });
        },
    },
    // 18. Close all
    {
        name: 'browser_close_all',
        title: 'Close All Sessions',
        description: 'Close all browser sessions.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            await browserManager.closeAll();
            return ok({ message: 'All sessions closed' });
        },
    },
    // ===== ANTI-DETECTION TOOLS =====
    // 19. Apply random user agent
    {
        name: 'anti_detect_apply_user_agent',
        title: 'Apply Random User Agent',
        description: 'Get a random user agent string for session configuration.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            const ua = antiDetection.getRandomUserAgent();
            return ok({ userAgent: ua });
        },
    },
    // 20. Warmup session
    {
        name: 'anti_detect_warmup_session',
        title: 'Warmup Session',
        description: 'Browse common sites to make the session appear human.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
            sites: z.array(z.string()).optional().describe('Custom list of sites to visit'),
        }),
        execute: async (args) => {
            const sid = args.session_id;
            const result = await antiDetection.warmupSession(sid);
            return ok({ sessionId: sid, visited: result.visited, errors: result.errors });
        },
    },
    // 21. Generate random name
    {
        name: 'anti_detect_generate_name',
        title: 'Generate Random Name',
        description: 'Generate a realistic random name.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            const name = await antiDetection.generateName();
            return ok({ name });
        },
    },
    // 22. Generate birthday
    {
        name: 'anti_detect_generate_birthday',
        title: 'Generate Birthday',
        description: 'Generate a random birthday.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            const birthday = antiDetection.generateBirthday();
            return ok(birthday);
        },
    },
    // 23. Update anti-detection config
    {
        name: 'anti_detect_update_config',
        title: 'Update Anti-Detection Config',
        description: 'Update anti-detection configuration.',
        inputSchema: z.object({
            typing_delay_min: z.number().int().min(0).optional().describe('Min typing delay ms'),
            typing_delay_max: z.number().int().min(0).optional().describe('Max typing delay ms'),
            action_delay_min: z.number().int().min(0).optional().describe('Min action delay ms'),
            action_delay_max: z.number().int().min(0).optional().describe('Max action delay ms'),
            session_warming_enabled: z.boolean().optional().describe('Enable session warming'),
            rotate_user_agent: z.boolean().optional().describe('Rotate user agents'),
        }).partial(),
        execute: async (args) => {
            antiDetection.updateConfig(args);
            return ok({ message: 'Anti-detection config updated', config: antiDetection.getConfig() });
        },
    },
    // ===== PHONE VERIFICATION TOOLS =====
    // 24. Purchase phone number
    {
        name: 'phone_verify_purchase_number',
        title: 'Purchase Phone Number',
        description: 'Purchase a phone number from 5sim for verification.',
        inputSchema: z.object({
            country: z.string().describe('Country code e.g. "US", "RU"'),
            product: z.string().optional().describe('Service product e.g. "google"').default('google'),
            carrier: z.string().optional().describe('Carrier preference').default('any'),
        }),
        execute: async (args) => {
            const result = await phoneVerification.purchaseNumber(args.country, args.carrier, args.product);
            return ok(result);
        },
    },
    // 25. Get SMS code
    {
        name: 'phone_verify_get_code',
        title: 'Get SMS Code',
        description: 'Retrieve SMS verification code for purchased number.',
        inputSchema: z.object({
            order_id: z.string().describe('Order ID from purchase'),
        }),
        execute: async (args) => {
            const code = await phoneVerification.getCode(args.order_id);
            return ok({ orderId: args.order_id, code: code || 'not received yet' });
        },
    },
    // 26. Skip verification
    {
        name: 'phone_verify_skip',
        title: 'Skip Verification',
        description: 'Attempt to skip phone verification on the page.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
        }),
        execute: async (args) => {
            const page = browserManager['pages'].get(args.session_id);
            if (!page)
                throw new Error('Page not found');
            const success = await phoneVerification.trySkipVerification(page, args.session_id);
            return ok({ sessionId: args.session_id, skipped: success });
        },
    },
    // 27. Try alternative method
    {
        name: 'phone_verify_alternative_method',
        title: 'Try Alternative Method',
        description: 'Try alternative verification methods.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
        }),
        execute: async (args) => {
            const page = browserManager['pages'].get(args.session_id);
            if (!page)
                throw new Error('Page not found');
            const success = await phoneVerification.tryAlternativeMethod(page, args.session_id);
            return ok({ sessionId: args.session_id, alternativeSelected: success });
        },
    },
    // 28. Complete verification flow
    {
        name: 'phone_verify_complete',
        title: 'Complete Verification Flow',
        description: 'Complete full phone verification with auto-retry.',
        inputSchema: z.object({
            session_id: z.string().describe('Session ID'),
            country: z.string().optional().describe('Country code').default('US'),
            product: z.string().optional().describe('Service product').default('google'),
        }),
        execute: async (args) => {
            const result = await phoneVerification.completeVerification(args.session_id, args.country, args.product);
            return ok(result);
        },
    },
    // 29. Update phone verification config
    {
        name: 'phone_verify_update_config',
        title: 'Update Phone Verification Config',
        description: 'Update phone verification configuration.',
        inputSchema: z.object({
            enabled: z.boolean().optional().describe('Enable phone verification'),
            five_sim_api_key: z.string().optional().describe('5sim API key'),
            max_retries: z.number().int().optional().describe('Max retry attempts'),
        }).partial(),
        execute: async (args) => {
            phoneVerification.updateConfig(args);
            return ok({ message: 'Phone verification config updated', config: phoneVerification.getConfig() });
        },
    },
    // ===== PROXY MANAGEMENT TOOLS =====
    // 30. Fetch proxies
    {
        name: 'proxy_fetch',
        title: 'Fetch Proxies',
        description: 'Fetch fresh proxies from free sources.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            const proxies = await proxyManager.fetchProxies();
            return ok({ fetched: proxies.length, stats: proxyManager.getStats() });
        },
    },
    // 31. Get random proxy
    {
        name: 'proxy_get_random',
        title: 'Get Random Proxy',
        description: 'Get a random valid proxy.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            const proxy = proxyManager.getRandomProxy();
            return ok(proxy || { message: 'No proxies available' });
        },
    },
    // 32. Add custom proxy
    {
        name: 'proxy_add_custom',
        title: 'Add Custom Proxy',
        description: 'Add a custom proxy (format: "ip:port").',
        inputSchema: z.object({
            proxy_string: z.string().describe('Proxy in format "ip:port"'),
        }),
        execute: async (args) => {
            const success = proxyManager.addCustomProxy(args.proxy_string);
            return ok({ added: success, proxyString: args.proxy_string });
        },
    },
    // 33. Get proxy stats
    {
        name: 'proxy_get_stats',
        title: 'Get Proxy Statistics',
        description: 'Get proxy pool statistics.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            return ok(proxyManager.getStats());
        },
    },
    // 34. Reset used proxies
    {
        name: 'proxy_reset',
        title: 'Reset Used Proxies',
        description: 'Reset the used proxy tracker for new sessions.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            proxyManager.resetUsedProxies();
            return ok({ message: 'Used proxies reset' });
        },
    },
    // 35. Update proxy config
    {
        name: 'proxy_update_config',
        title: 'Update Proxy Config',
        description: 'Update proxy configuration.',
        inputSchema: z.object({
            enabled: z.boolean().optional().describe('Enable proxy'),
            free_proxy_enabled: z.boolean().optional().describe('Enable free proxy fetching'),
        }).partial(),
        execute: async (args) => {
            proxyManager.updateConfig(args);
            return ok({ message: 'Proxy config updated', config: proxyManager.getConfig() });
        },
    },
    // ===== ACCOUNT MANAGEMENT TOOLS =====
    // 36. Save account
    {
        name: 'accounts_save',
        title: 'Save Account',
        description: 'Save an account with automatic backup.',
        inputSchema: z.object({
            email: z.string().describe('Email address'),
            password: z.string().describe('Password'),
            name: z.string().optional().describe('Full name'),
            phone: z.string().optional().describe('Phone number'),
            country: z.string().optional().describe('Country'),
            status: z.enum(['created', 'verified', 'failed', 'pending']).optional().describe('Account status').default('created'),
            notes: z.string().optional().describe('Notes'),
        }),
        execute: async (args) => {
            const account = accountManager.saveAccount(args);
            return ok(account);
        },
    },
    // 37. Get statistics
    {
        name: 'accounts_get_statistics',
        title: 'Get Account Statistics',
        description: 'Get detailed account creation statistics.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            return ok(accountManager.getStatistics());
        },
    },
    // 38. Get all accounts
    {
        name: 'accounts_get_all',
        title: 'Get All Accounts',
        description: 'Get all saved accounts.',
        inputSchema: z.object({
            limit: z.number().int().optional().describe('Limit results').default(100),
        }),
        execute: async (args) => {
            const accounts = accountManager.getAllAccounts().slice(-args.limit);
            return ok({ count: accounts.length, accounts });
        },
    },
    // 39. Get recent accounts
    {
        name: 'accounts_get_recent',
        title: 'Get Recent Accounts',
        description: 'Get recently created accounts.',
        inputSchema: z.object({
            limit: z.number().int().optional().describe('Limit results').default(10),
        }),
        execute: async (args) => {
            const accounts = accountManager.getRecentAccounts(args.limit);
            return ok({ count: accounts.length, accounts });
        },
    },
    // 40. Update account status
    {
        name: 'accounts_update_status',
        title: 'Update Account Status',
        description: 'Update account verification status.',
        inputSchema: z.object({
            account_id: z.string().describe('Account ID'),
            status: z.enum(['created', 'verified', 'failed', 'pending']).describe('New status'),
            notes: z.string().optional().describe('Notes'),
        }),
        execute: async (args) => {
            const success = accountManager.updateAccountStatus(args.account_id, args.status, args.notes);
            return ok({ accountId: args.account_id, updated: success });
        },
    },
    // 41. Export accounts
    {
        name: 'accounts_export',
        title: 'Export Accounts',
        description: 'Export accounts in JSON or CSV format.',
        inputSchema: z.object({
            format: z.enum(['json', 'csv']).optional().describe('Export format').default('json'),
        }),
        execute: async (args) => {
            const data = accountManager.exportAccounts(args.format);
            return ok({ format: args.format, dataLength: data.length, preview: data.substring(0, 500) });
        },
    },
    // 42. Delete account
    {
        name: 'accounts_delete',
        title: 'Delete Account',
        description: 'Delete a specific account.',
        inputSchema: z.object({
            account_id: z.string().describe('Account ID'),
        }),
        execute: async (args) => {
            const success = accountManager.deleteAccount(args.account_id);
            return ok({ accountId: args.account_id, deleted: success });
        },
    },
    // ===== CONFIGURATION TOOLS =====
    // 43. Get config
    {
        name: 'config_get',
        title: 'Get Configuration',
        description: 'Get current server configuration.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            return ok(configManager.getConfig());
        },
    },
    // 44. Update config
    {
        name: 'config_update',
        title: 'Update Configuration',
        description: 'Update server configuration.',
        inputSchema: z.object({}).passthrough(),
        execute: async (args) => {
            configManager.updateConfig(args);
            return ok({ message: 'Configuration updated', config: configManager.getConfig() });
        },
    },
    // 45. Set API key securely
    {
        name: 'config_set_api_key',
        title: 'Set API Key',
        description: 'Set API key securely in separate config file.',
        inputSchema: z.object({
            api_key: z.string().describe('API key value'),
        }),
        execute: async (args) => {
            configManager.setApiKey(args.api_key);
            return ok({ message: 'API key set securely' });
        },
    },
    // 46. Set password securely
    {
        name: 'config_set_password',
        title: 'Set Password',
        description: 'Set password securely in separate config file.',
        inputSchema: z.object({
            password: z.string().describe('Password value'),
        }),
        execute: async (args) => {
            configManager.setPassword(args.password);
            return ok({ message: 'Password set securely' });
        },
    },
    // 47. Reset config
    {
        name: 'config_reset',
        title: 'Reset Configuration',
        description: 'Reset all configuration to defaults.',
        inputSchema: z.object({}).strict(),
        execute: async () => {
            configManager.resetToDefaults();
            return ok({ message: 'Configuration reset to defaults' });
        },
    },
];
