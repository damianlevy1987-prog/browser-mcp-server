import fs from 'fs';
import path from 'path';
const ACCOUNTS_DIR = path.join(process.cwd(), 'data', 'accounts');
const ACCOUNTS_FILE = path.join(ACCOUNTS_DIR, 'accounts.json');
const BACKUP_DIR = path.join(ACCOUNTS_DIR, 'backups');
class AccountManager {
    accounts = [];
    stats;
    constructor() {
        this.stats = {
            totalCreated: 0,
            activeAccounts: 0,
            successRate: 0,
            lastCreated: null,
            byCountry: {},
            byStatus: {},
        };
    }
    // Initialize storage
    initialize() {
        try {
            // Create directories if they don't exist
            if (!fs.existsSync(ACCOUNTS_DIR)) {
                fs.mkdirSync(ACCOUNTS_DIR, { recursive: true });
            }
            if (!fs.existsSync(BACKUP_DIR)) {
                fs.mkdirSync(BACKUP_DIR, { recursive: true });
            }
            // Load existing accounts
            if (fs.existsSync(ACCOUNTS_FILE)) {
                const data = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
                this.accounts = JSON.parse(data);
                this.recalculateStats();
                console.error(`[browser-mcp][accounts] Loaded ${this.accounts.length} accounts`);
            }
        }
        catch (err) {
            console.error('[browser-mcp][accounts] Failed to initialize:', err);
        }
    }
    // Save account immediately after creation
    saveAccount(account) {
        const newAccount = {
            ...account,
            id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            createdAt: new Date().toISOString(),
        };
        this.accounts.push(newAccount);
        this.saveToDisk();
        this.recalculateStats();
        console.error(`[browser-mcp][accounts] Saved account: ${newAccount.id}`);
        return newAccount;
    }
    // Save all accounts to disk
    saveToDisk() {
        try {
            fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.accounts, null, 2), 'utf-8');
            // Create backup
            this.createBackup();
        }
        catch (err) {
            console.error('[browser-mcp][accounts] Failed to save:', err);
        }
    }
    // Create automatic backup
    createBackup() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(BACKUP_DIR, `accounts-${timestamp}.json`);
            fs.writeFileSync(backupFile, JSON.stringify(this.accounts, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[browser-mcp][accounts] Backup failed:', err);
        }
    }
    // Recalculate statistics
    recalculateStats() {
        this.stats.totalCreated = this.accounts.length;
        this.stats.activeAccounts = this.accounts.filter((a) => a.status === 'verified').length;
        const successful = this.accounts.filter((a) => a.status === 'verified' || a.status === 'created').length;
        this.stats.successRate = this.accounts.length > 0 ? (successful / this.accounts.length) * 100 : 0;
        this.stats.lastCreated = this.accounts.length > 0
            ? this.accounts[this.accounts.length - 1].createdAt
            : null;
        // Count by country
        this.stats.byCountry = {};
        for (const account of this.accounts) {
            const country = account.country || 'unknown';
            this.stats.byCountry[country] = (this.stats.byCountry[country] || 0) + 1;
        }
        // Count by status
        this.stats.byStatus = {};
        for (const account of this.accounts) {
            const status = account.status;
            this.stats.byStatus[status] = (this.stats.byStatus[status] || 0) + 1;
        }
    }
    // Get statistics
    getStatistics() {
        return { ...this.stats };
    }
    // Get all accounts
    getAllAccounts() {
        return [...this.accounts];
    }
    // Get account by ID
    getAccount(id) {
        return this.accounts.find((a) => a.id === id);
    }
    // Update account status
    updateAccountStatus(id, status, notes) {
        const account = this.accounts.find((a) => a.id === id);
        if (!account)
            return false;
        account.status = status;
        if (notes)
            account.notes = notes;
        this.saveToDisk();
        this.recalculateStats();
        return true;
    }
    // Delete account
    deleteAccount(id) {
        const index = this.accounts.findIndex((a) => a.id === id);
        if (index === -1)
            return false;
        this.accounts.splice(index, 1);
        this.saveToDisk();
        this.recalculateStats();
        return true;
    }
    // Export accounts to file
    exportAccounts(format = 'json') {
        if (format === 'json') {
            return JSON.stringify(this.accounts, null, 2);
        }
        else if (format === 'csv') {
            const headers = ['id', 'email', 'password', 'name', 'phone', 'country', 'createdAt', 'status'];
            const rows = this.accounts.map((a) => headers.map((h) => `"${a[h] || ''}"`).join(','));
            return [headers.join(','), ...rows].join('\n');
        }
        return '';
    }
    // Import accounts from file
    importAccounts(data, format = 'json') {
        try {
            if (format === 'json') {
                const imported = JSON.parse(data);
                if (Array.isArray(imported)) {
                    this.accounts.push(...imported);
                    this.saveToDisk();
                    this.recalculateStats();
                    return imported.length;
                }
            }
            else if (format === 'csv') {
                // CSV parsing would go here
                console.error('[browser-mcp][accounts] CSV import not yet implemented');
            }
        }
        catch (err) {
            console.error('[browser-mcp][accounts] Import failed:', err);
        }
        return 0;
    }
    // Filter accounts by status
    getAccountsByStatus(status) {
        return this.accounts.filter((a) => a.status === status);
    }
    // Get recent accounts
    getRecentAccounts(limit = 10) {
        return this.accounts.slice(-limit).reverse();
    }
    // Clear all accounts
    clearAll() {
        this.accounts = [];
        this.saveToDisk();
        this.recalculateStats();
    }
}
export const accountManager = new AccountManager();
