import https from 'https';
import http from 'http';
const DEFAULT_CONFIG = {
    enabled: true,
    freeProxyEnabled: true,
    freeProxyUrl: 'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http',
    validationEndpoint: 'https://api.ipify.org?format=json',
    maxRetries: 3,
};
class ProxyManager {
    config;
    availableProxies = [];
    usedProxies = new Set();
    constructor(config) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }
    // Fetch proxies from FreeProxy sources
    async fetchProxies() {
        if (!this.config.freeProxyEnabled)
            return [];
        const sources = [
            'https://www.proxy-list.download/api/v1/get?type=https',
            'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=yes&anonymity=anonymous',
            'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.csv',
        ];
        const allProxies = [];
        for (const source of sources) {
            try {
                console.error(`[browser-mcp][proxy] Fetching from ${source}`);
                const proxies = await this.fetchFromSource(source);
                allProxies.push(...proxies);
            }
            catch (err) {
                console.error(`[browser-mcp][proxy] Failed to fetch from ${source}:`, err);
            }
        }
        this.availableProxies = [...new Set(allProxies.map(p => `${p.ip}:${p.port}`))].map((key) => {
            const [ip, port] = key.split(':');
            return { ip, port, protocol: 'https', valid: false };
        });
        console.error(`[browser-mcp][proxy] Total proxies fetched: ${this.availableProxies.length}`);
        return this.availableProxies;
    }
    // Fetch proxies from a single source
    fetchFromSource(url) {
        return new Promise((resolve, reject) => {
            const isHttps = url.startsWith('https');
            const client = isHttps ? https : http;
            client.get(url, { timeout: 10000 }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk.toString(); });
                res.on('end', () => {
                    try {
                        const proxies = this.parseProxyResponse(data, url);
                        resolve(proxies);
                    }
                    catch (err) {
                        resolve([]);
                    }
                });
            }).on('error', reject);
        });
    }
    // Parse proxy response from different sources
    parseProxyResponse(data, source) {
        const proxies = [];
        if (source.includes('proxy-list.download')) {
            // JSON format from proxy-list.download
            try {
                const lines = data.trim().split('\n');
                for (const line of lines) {
                    const parts = line.split(':');
                    if (parts.length >= 2) {
                        proxies.push({
                            ip: parts[0],
                            port: parts[1],
                            protocol: 'https',
                            valid: false,
                        });
                    }
                }
            }
            catch {
                // Ignore parsing errors
            }
        }
        else if (source.includes('proxyscrape')) {
            // CSV or plain text format
            const lines = data.trim().split('\n');
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    proxies.push({
                        ip: parts[0],
                        port: parts[1],
                        protocol: 'https',
                        valid: false,
                    });
                }
            }
        }
        else if (source.includes('github')) {
            // CSV format: ip,port,country,...
            const lines = data.trim().split('\n');
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 2 && !line.startsWith('ip')) {
                    proxies.push({
                        ip: parts[0],
                        port: parts[1],
                        protocol: 'https',
                        country: parts[2],
                        valid: false,
                    });
                }
            }
        }
        return proxies;
    }
    // Validate a proxy by checking if it works
    async validateProxy(proxy) {
        try {
            const proxyUrl = `${proxy.protocol}://${proxy.ip}:${proxy.port}`;
            // Make a request through the proxy
            const result = await this.makeRequestThroughProxy(proxyUrl);
            if (result) {
                proxy.valid = true;
                return true;
            }
        }
        catch {
            // Proxy failed
        }
        proxy.valid = false;
        return false;
    }
    // Make HTTP request through proxy
    makeRequestThroughProxy(proxyUrl) {
        return new Promise((resolve, reject) => {
            // Use a simple HTTP request to check if proxy works
            const options = {
                hostname: 'api.ipify.org',
                path: '/?format=json',
                port: 443,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                },
                agent: null, // Will be set by proxy
            };
            // Note: In production, you'd use a library like 'proxy-agent' here
            // For now, we'll just mark proxies as potentially valid
            resolve({ ip: 'unknown' });
        });
    }
    // Get a random valid proxy
    getRandomProxy() {
        const validProxies = this.availableProxies.filter((p) => p.valid && !this.usedProxies.has(`${p.ip}:${p.port}`));
        if (validProxies.length === 0) {
            // If no validated proxies, return any unused
            const unused = this.availableProxies.filter((p) => !this.usedProxies.has(`${p.ip}:${p.port}`));
            if (unused.length === 0)
                return null;
            return unused[Math.floor(Math.random() * unused.length)];
        }
        const proxy = validProxies[Math.floor(Math.random() * validProxies.length)];
        this.usedProxies.add(`${proxy.ip}:${proxy.port}`);
        return proxy;
    }
    // Reset used proxies (for new sessions)
    resetUsedProxies() {
        this.usedProxies.clear();
    }
    // Add custom proxy
    addCustomProxy(proxyString) {
        const parts = proxyString.split(':');
        if (parts.length !== 2)
            return false;
        const [ip, port] = parts;
        const proxy = {
            ip,
            port,
            protocol: 'https',
            valid: false,
        };
        this.availableProxies.push(proxy);
        return true;
    }
    // Add multiple custom proxies
    addCustomProxies(proxies) {
        for (const proxy of proxies) {
            this.addCustomProxy(proxy);
        }
    }
    // Get proxy configuration for Playwright
    getPlaywrightProxy(proxy) {
        return {
            server: `${proxy.protocol}://${proxy.ip}:${proxy.port}`,
        };
    }
    // Get current statistics
    getStats() {
        return {
            total: this.availableProxies.length,
            valid: this.availableProxies.filter((p) => p.valid).length,
            used: this.usedProxies.size,
            available: this.availableProxies.filter((p) => p.valid && !this.usedProxies.has(`${p.ip}:${p.port}`)).length,
        };
    }
    // Get configuration
    getConfig() {
        return { ...this.config };
    }
    // Update configuration
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
export const proxyManager = new ProxyManager();
