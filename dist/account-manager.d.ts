interface Account {
    id: string;
    email: string;
    password: string;
    name?: string;
    phone?: string;
    country?: string;
    birthday?: {
        year: number;
        month: number;
        day: number;
    };
    gender?: 'Male' | 'Female' | 'Other';
    proxy?: string;
    userAgent?: string;
    createdAt: string;
    status: 'created' | 'verified' | 'failed' | 'pending';
    notes?: string;
}
interface Statistics {
    totalCreated: number;
    activeAccounts: number;
    successRate: number;
    lastCreated: string | null;
    byCountry: Record<string, number>;
    byStatus: Record<string, number>;
}
declare class AccountManager {
    private accounts;
    private stats;
    constructor();
    initialize(): void;
    saveAccount(account: Omit<Account, 'id' | 'createdAt'>): Account;
    private saveToDisk;
    private createBackup;
    private recalculateStats;
    getStatistics(): Statistics;
    getAllAccounts(): Account[];
    getAccount(id: string): Account | undefined;
    updateAccountStatus(id: string, status: Account['status'], notes?: string): boolean;
    deleteAccount(id: string): boolean;
    exportAccounts(format?: 'json' | 'csv'): string;
    importAccounts(data: string, format?: 'json' | 'csv'): number;
    getAccountsByStatus(status: Account['status']): Account[];
    getRecentAccounts(limit?: number): Account[];
    clearAll(): void;
}
export declare const accountManager: AccountManager;
export type { Account, Statistics };
