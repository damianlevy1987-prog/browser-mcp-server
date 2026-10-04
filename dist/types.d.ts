export type BrowserName = 'firefox' | 'chromium' | 'edge' | 'safari' | 'tor';
export type LaunchMode = 'headed' | 'headless';
export interface BrowserConfig {
    name: BrowserName;
    mode: LaunchMode;
    args?: string[];
    viewport?: {
        width: number;
        height: number;
    };
    userAgent?: string;
    locale?: string;
    proxy?: {
        server: string;
        username?: string;
        password?: string;
    };
    ignoreHTTPSErrors?: boolean;
    downloadsPath?: string;
    bypassCSP?: boolean;
}
export interface BrowserSession {
    id: string;
    browserName: BrowserName;
    mode: LaunchMode;
    state: 'idle' | 'navigating' | 'error';
    currentUrl?: string;
    cookies: Cookie[];
    localStorage: Record<string, string>;
}
export interface Cookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'Strict' | 'Lax' | 'None';
    expiration?: number;
}
export interface NavigationResult {
    url: string;
    title: string;
    status?: number;
    loadTimeMs?: number;
}
export interface ScreenshotResult {
    data: string;
    mimeType: string;
    width: number;
    height: number;
}
export interface ConsoleMessage {
    type: 'log' | 'debug' | 'info' | 'warn' | 'error';
    text: string;
    timestamp: number;
}
export interface ExecutionResult<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
}
export interface BrowserInfo {
    name: BrowserName;
    available: boolean;
    version?: string;
    installed: boolean;
}
export interface SessionList {
    sessions: SessionSummary[];
}
export interface SessionSummary {
    id: string;
    browserName: BrowserName;
    mode: LaunchMode;
    state: 'idle' | 'navigating' | 'error';
    currentUrl?: string;
}
