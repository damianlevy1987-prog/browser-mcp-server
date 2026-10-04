interface SecureConfig {
    apiKey?: string;
    password?: string;
    databaseUrl?: string;
    jwtSecret?: string;
}
interface AppConfig {
    antiDetection: {
        enabled: boolean;
        typingDelayMin: number;
        typingDelayMax: number;
        actionDelayMin: number;
        actionDelayMax: number;
        sessionWarmingEnabled: boolean;
        rotateUserAgent: boolean;
        namesFile?: string;
    };
    phoneVerification: {
        enabled: boolean;
        fiveSimApiKey?: string;
        maxRetries: number;
        retryDelay: number;
    };
    proxy: {
        enabled: boolean;
        freeProxyEnabled: boolean;
        customProxies?: string[];
    };
    accounts: {
        autoSave: boolean;
        backupEnabled: boolean;
    };
    security: SecureConfig;
}
declare class ConfigManager {
    private config;
    constructor();
    private getDefaultConfig;
    initialize(): void;
    getConfig(): AppConfig;
    updateConfig(updates: Partial<AppConfig>): void;
    updateSecureConfig(updates: Partial<SecureConfig>): void;
    getApiKey(): string | undefined;
    setApiKey(key: string): void;
    getPassword(): string | undefined;
    setPassword(password: string): void;
    private saveMainConfig;
    private saveSecureConfig;
    exportConfig(): string;
    importConfig(data: string): boolean;
    resetToDefaults(): void;
}
export declare const configManager: ConfigManager;
export type { AppConfig, SecureConfig };
