import https from 'https';
import { browserManager } from './browser-manager.js';
import { antiDetection } from './anti-detection.js';

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

interface SkipStrategy {
  name: string;
  selector: string;
  label: string;
}

const DEFAULT_CONFIG: PhoneVerificationConfig = {
  enabled: true,
  fiveSimBaseUrl: 'https://5sim.net',
  maxRetries: 3,
  retryDelay: 2000,
  skipSelectors: [
    'button:has-text("Skip")',
    'button:has-text("تخطي")', // Arabic
    'a:has-text("Skip")',
    'div:has-text("Skip")',
    '[data-testid="skip-button"]',
    '.skip-btn',
  ],
  tryAnotherWaySelectors: [
    'button:has-text("Try another way")',
    'button:has-text("جرب طريقة أخرى")', // Arabic
    'a:has-text("Try another way")',
    '[data-testid="alternative-method"]',
  ],
};

class PhoneVerificationSystem {
  private config: PhoneVerificationConfig;

  constructor(config?: Partial<PhoneVerificationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Purchase a phone number from 5sim
  async purchaseNumber(country: string, carrier: string = 'any', product: string = 'google'): Promise<PhonePurchaseResult> {
    if (!this.config.enabled) {
      return { success: false, error: 'Phone verification is disabled' };
    }

    if (!this.config.fiveSimApiKey) {
      return { success: false, error: '5sim API key not configured' };
    }

    const url = `${this.config.fiveSimBaseUrl}/api/get/phones/${country}/${product}/${carrier}`;

    try {
      const result = await this.makeApiRequest(url);
      
      if (!result || !result.max || !result.id) {
        return { success: false, error: 'No phone number available' };
      }

      console.error(`[browser-mcp][phone-verify] Purchased number: ${result.max}`);
      return {
        success: true,
        phone: result.max,
        id: result.id,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // Get SMS code for purchased number
  async getCode(orderId: string): Promise<string | null> {
    if (!this.config.fiveSimApiKey) return null;

    const url = `${this.config.fiveSimBaseUrl}/api/get/sms/${orderId}`;

    try {
      const result = await this.makeApiRequest(url);
      
      if (result && result.code) {
        console.error(`[browser-mcp][phone-verify] Got SMS code: ${result.code}`);
        return result.code;
      }

      return null;
    } catch {
      return null;
    }
  }

  // Make HTTPS API request to 5sim
  private makeApiRequest(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: new URL(url).hostname,
        path: new URL(url).pathname + new URL(url).search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Authorization': `APIToken ${this.config.fiveSimApiKey}`,
        },
      };

      const req = https.get(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('API request timeout'));
      });
    });
  }

  // Try to skip phone verification
  async trySkipVerification(page: any, sessionId: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    console.error(`[browser-mcp][phone-verify] Attempting to skip verification...`);

    // Try each skip strategy
    for (const selector of this.config.skipSelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await antiDetection.delay(500, 1500);
          console.error(`[browser-mcp][phone-verify] Successfully clicked skip button`);
          return true;
        }
      } catch {
        // Continue to next selector
      }
    }

    return false;
  }

  // Try alternative methods for phone verification
  async tryAlternativeMethod(page: any, sessionId: string): Promise<boolean> {
    if (!this.config.enabled) return false;

    console.error(`[browser-mcp][phone-verify] Trying alternative methods...`);

    for (const selector of this.config.tryAnotherWaySelectors) {
      try {
        const element = await page.locator(selector).first();
        if (await element.isVisible()) {
          await element.click();
          await antiDetection.delay(500, 1500);
          console.error(`[browser-mcp][phone-verify] Clicked alternative method`);
          return true;
        }
      } catch {
        // Continue
      }
    }

    return false;
  }

  // Complete phone verification flow with automatic code retrieval
  async completeVerification(sessionId: string, country: string = 'US', product: string = 'google'): Promise<{
    success: boolean;
    phoneNumber?: string;
    code?: string;
    steps: string[];
    errors: string[];
  }> {
    const steps: string[] = [];
    const errors: string[] = [];

    try {
      // Step 1: Get session and page
      const session = browserManager.getSession(sessionId);
      if (!session) {
        return { success: false, steps, errors: ['Session not found'] };
      }

      // Step 2: Try to skip first
      steps.push('Attempting to skip verification');
      const skipped = await this.trySkipVerification(null as any, sessionId);
      if (skipped) {
        steps.push('Successfully skipped verification');
        return { success: true, steps, errors };
      }

      // Step 3: Try alternative methods
      steps.push('Trying alternative methods');
      const altMethod = await this.tryAlternativeMethod(null as any, sessionId);
      if (altMethod) {
        steps.push('Alternative method selected');
        return { success: true, steps, errors };
      }

      // Step 4: Purchase phone number
      steps.push('Purchasing phone number from 5sim');
      const purchase = await this.purchaseNumber(country, 'any', product);
      if (!purchase.success) {
        errors.push(`Failed to purchase number: ${purchase.error}`);
        return { success: false, steps, errors };
      }

      steps.push(`Purchased number: ${purchase.phone}`);

      // Step 5: Wait for SMS and retrieve code
      steps.push('Waiting for SMS code');
      let code: string | null = null;
      
      for (let i = 0; i < this.config.maxRetries; i++) {
        await new Promise((resolve) => setTimeout(resolve, this.config.retryDelay));
        code = await this.getCode(purchase.id!);
        if (code) break;
      }

      if (!code) {
        errors.push('Failed to retrieve SMS code after multiple attempts');
        return { success: false, steps, errors };
      }

      steps.push(`Received SMS code: ${code}`);

      return {
        success: true,
        phoneNumber: purchase.phone,
        code,
        steps,
        errors,
      };

    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      return { success: false, steps, errors };
    }
  }

  // Get configuration
  getConfig(): PhoneVerificationConfig {
    return { ...this.config };
  }

  // Update configuration
  updateConfig(config: Partial<PhoneVerificationConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

export const phoneVerification = new PhoneVerificationSystem();
export type { PhoneVerificationConfig, PhonePurchaseResult };
