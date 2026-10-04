interface PhoneVerificationConfig {
    enabled: boolean;
    fiveSimApiKey?: string;
    fiveSimBaseUrl: string;
    maxRetries: number;
    retryDelay: number;
    skipSelectors: string[];
    tryAnotherWaySelectors: string[];
}
interface PhonePurchaseResult {
    success: boolean;
    phone?: string;
    id?: string;
    code?: string;
    error?: string;
}
declare class PhoneVerificationSystem {
    private config;
    constructor(config?: Partial<PhoneVerificationConfig>);
    purchaseNumber(country: string, carrier?: string, product?: string): Promise<PhonePurchaseResult>;
    getCode(orderId: string): Promise<string | null>;
    private makeApiRequest;
    trySkipVerification(page: any, sessionId: string): Promise<boolean>;
    tryAlternativeMethod(page: any, sessionId: string): Promise<boolean>;
    completeVerification(sessionId: string, country?: string, product?: string): Promise<{
        success: boolean;
        phoneNumber?: string;
        code?: string;
        steps: string[];
        errors: string[];
    }>;
    getConfig(): PhoneVerificationConfig;
    updateConfig(config: Partial<PhoneVerificationConfig>): void;
}
export declare const phoneVerification: PhoneVerificationSystem;
export type { PhoneVerificationConfig, PhonePurchaseResult };
