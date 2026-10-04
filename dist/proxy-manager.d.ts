interface ProxyConfig {
    enabled: boolean;
    freeProxyEnabled: boolean;
    freeProxyUrl: string;
    customProxies?: string[];
    validationEndpoint: string;
    maxRetries: number;
}
interface ProxyInfo {
    ip: string;
    port: string;
    protocol: 'http' | 'https';
    country?: string;
    anonymity?: string;
    valid: boolean;
}
declare class ProxyManager {
    private config;
    private availableProxies;
    private usedProxies;
    constructor(config?: Partial<ProxyConfig>);
    fetchProxies(): Promise<ProxyInfo[]>;
    private fetchFromSource;
    private parseProxyResponse;
    validateProxy(proxy: ProxyInfo): Promise<boolean>;
    private makeRequestThroughProxy;
    getRandomProxy(): ProxyInfo | null;
    resetUsedProxies(): void;
    addCustomProxy(proxyString: string): boolean;
    addCustomProxies(proxies: string[]): void;
    getPlaywrightProxy(proxy: ProxyInfo): {
        server: string;
        username?: string;
        password?: string;
    };
    getStats(): {
        total: number;
        valid: number;
        used: number;
        available: number;
    };
    getConfig(): ProxyConfig;
    updateConfig(config: Partial<ProxyConfig>): void;
}
export declare const proxyManager: ProxyManager;
export type { ProxyConfig, ProxyInfo };
