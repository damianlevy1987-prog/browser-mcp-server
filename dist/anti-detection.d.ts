import type { Page, BrowserContext } from 'playwright';
interface AntiDetectionConfig {
    enabled: boolean;
    typingDelayMin: number;
    typingDelayMax: number;
    actionDelayMin: number;
    actionDelayMax: number;
    sessionWarmingEnabled: boolean;
    warmupSites: string[];
    rotateUserAgent: boolean;
    customUserAgents?: string[];
    namesFile?: string;
}
declare class AntiDetectionSystem {
    private config;
    private currentPage;
    private context;
    private currentSessionId;
    constructor(config?: Partial<AntiDetectionConfig>);
    setActive(page: Page, context: BrowserContext, sessionId: string): void;
    clearActive(): void;
    apply(page: Page, context: BrowserContext, sessionId: string): Promise<void>;
    private hideAutomationSignatures;
    getRandomUserAgent(): string;
    applyRandomUserAgent(context: BrowserContext): Promise<void>;
    private applyStealthScripts;
    typeHumanely(selector: string, text: string, options?: {
        delayMin?: number;
        delayMax?: number;
    }): Promise<void>;
    delay(min?: number, max?: number): Promise<void>;
    warmupSession(sessionId: string): Promise<{
        visited: string[];
        errors: string[];
    }>;
    generateName(): Promise<string>;
    generateBirthday(): {
        year: number;
        month: number;
        day: number;
    };
    getConfig(): AntiDetectionConfig;
    updateConfig(config: Partial<AntiDetectionConfig>): void;
}
export declare const antiDetection: AntiDetectionSystem;
export type { AntiDetectionConfig };
