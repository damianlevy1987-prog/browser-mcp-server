import type { Page } from 'playwright';
import type { BrowserConfig, BrowserSession, BrowserInfo, SessionSummary } from './types.js';
declare class BrowserManager {
    private sessions;
    private browsers;
    private contexts;
    private pages;
    private sessionCounter;
    launch(config: BrowserConfig): Promise<BrowserSession>;
    navigate(sessionId: string, url: string): Promise<{
        url: string;
        title: string;
    }>;
    screenshot(sessionId: string, options?: {
        fullPage?: boolean;
    }): Promise<{
        data: string;
        width: number;
        height: number;
    }>;
    evaluate(sessionId: string, expression: string): Promise<unknown>;
    getText(sessionId: string, selector: string): Promise<string>;
    click(sessionId: string, selector: string): Promise<void>;
    fill(sessionId: string, selector: string, value: string): Promise<void>;
    getCookies(sessionId: string): Promise<any[]>;
    setCookies(sessionId: string, cookies: any[]): Promise<void>;
    getLocalStorage(sessionId: string): Promise<Record<string, string>>;
    clearStorage(sessionId: string): Promise<void>;
    getPageCount(sessionId: string): Promise<number>;
    newTab(sessionId: string): Promise<Page>;
    closePage(sessionId: string): Promise<void>;
    getSource(sessionId: string): Promise<string>;
    getHeaders(sessionId: string): Promise<Record<string, string>>;
    checkAvailability(): Promise<BrowserInfo[]>;
    closeSession(sessionId: string): Promise<void>;
    closeAll(): Promise<void>;
    getSession(sessionId: string): BrowserSession | undefined;
    listSessions(): SessionSummary[];
}
export declare const browserManager: BrowserManager;
export {};
