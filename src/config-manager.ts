import fs from 'fs';
import path from 'path';

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

const CONFIG_DIR = path.join(process.cwd(), 'config');
const MAIN_CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
const SECURE_CONFIG_FILE = path.join(CONFIG_DIR, 'secure.json');

class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  private getDefaultConfig(): AppConfig {
    return {
      antiDetection: {
        enabled: true,
        typingDelayMin: 100,
        typingDelayMax: 300,
        actionDelayMin: 500,
        actionDelayMax: 1200,
        sessionWarmingEnabled: true,
        rotateUserAgent: true,
      },
      phoneVerification: {
        enabled: false, // Disabled by default for security
        fiveSimApiKey: undefined,
        maxRetries: 3,
        retryDelay: 2000,
      },
      proxy: {
        enabled: false,
        freeProxyEnabled: true,
        customProxies: [],
      },
      accounts: {
        autoSave: true,
        backupEnabled: true,
      },
      security: {},
    };
  }

  // Initialize configuration
  initialize(): void {
    try {
      if (!fs.existsSync(CONFIG_DIR)) {
        fs.mkdirSync(CONFIG_DIR, { recursive: true });
      }

      // Load main config
      if (fs.existsSync(MAIN_CONFIG_FILE)) {
        const data = fs.readFileSync(MAIN_CONFIG_FILE, 'utf-8');
        const loaded = JSON.parse(data);
        this.config = { ...this.config, ...loaded };
      }

      // Load secure config separately
      if (fs.existsSync(SECURE_CONFIG_FILE)) {
        const data = fs.readFileSync(SECURE_CONFIG_FILE, 'utf-8');
        const secure = JSON.parse(data);
        this.config.security = { ...this.config.security, ...secure };
      }

      console.error('[browser-mcp][config] Configuration loaded');
    } catch (err) {
      console.error('[browser-mcp][config] Failed to load config:', err);
    }
  }

  // Get full configuration
  getConfig(): AppConfig {
    return JSON.parse(JSON.stringify(this.config)); // Deep clone
  }

  // Update configuration
  updateConfig(updates: Partial<AppConfig>): void {
    this.config = { ...this.config, ...updates };
    this.saveMainConfig();
  }

  // Update secure configuration (stored separately)
  updateSecureConfig(updates: Partial<SecureConfig>): void {
    this.config.security = { ...this.config.security, ...updates };
    this.saveSecureConfig();
  }

  // Get API key from secure config
  getApiKey(): string | undefined {
    return this.config.security.apiKey || this.config.phoneVerification.fiveSimApiKey;
  }

  // Set API key securely
  setApiKey(key: string): void {
    this.config.security.apiKey = key;
    this.saveSecureConfig();
  }

  // Get password from secure config
  getPassword(): string | undefined {
    return this.config.security.password;
  }

  // Set password securely
  setPassword(password: string): void {
    this.config.security.password = password;
    this.saveSecureConfig();
  }

  // Save main config
  private saveMainConfig(): void {
    try {
      const configToSave = {
        ...this.config,
        security: {}, // Don't save secure data in main config
      };
      fs.writeFileSync(MAIN_CONFIG_FILE, JSON.stringify(configToSave, null, 2), 'utf-8');
    } catch (err) {
      console.error('[browser-mcp][config] Failed to save main config:', err);
    }
  }

  // Save secure config
  private saveSecureConfig(): void {
    try {
      fs.writeFileSync(SECURE_CONFIG_FILE, JSON.stringify(this.config.security, null, 2), 'utf-8');
      
      // Set restrictive permissions if on Unix
      try {
        fs.chmodSync(SECURE_CONFIG_FILE, 0o600);
      } catch {
        // Ignore permission errors on Windows
      }
    } catch (err) {
      console.error('[browser-mcp][config] Failed to save secure config:', err);
    }
  }

  // Export configuration for backup
  exportConfig(): string {
    return JSON.stringify(this.config, null, 2);
  }

  // Import configuration
  importConfig(data: string): boolean {
    try {
      const imported = JSON.parse(data);
      this.config = { ...this.getDefaultConfig(), ...imported };
      this.saveMainConfig();
      return true;
    } catch {
      return false;
    }
  }

  // Reset to defaults
  resetToDefaults(): void {
    this.config = this.getDefaultConfig();
    this.saveMainConfig();
    if (fs.existsSync(SECURE_CONFIG_FILE)) {
      fs.unlinkSync(SECURE_CONFIG_FILE);
    }
  }
}

export const configManager = new ConfigManager();
export type { AppConfig, SecureConfig };
