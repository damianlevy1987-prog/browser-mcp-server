import { z } from 'zod/v4';
export declare const tools: ({
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        browser: z.ZodEnum<{
            firefox: "firefox";
            chromium: "chromium";
            edge: "edge";
            safari: "safari";
            tor: "tor";
        }>;
        mode: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            headed: "headed";
            headless: "headless";
        }>>>;
        viewport_width: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        viewport_height: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        user_agent: z.ZodOptional<z.ZodString>;
        locale: z.ZodOptional<z.ZodString>;
        proxy_server: z.ZodOptional<z.ZodString>;
        ignore_https_errors: z.ZodOptional<z.ZodBoolean>;
        enable_anti_detection: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        enable_warmup: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        session_id: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        session_id: z.ZodString;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{}, z.core.$strict>;
    execute: () => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        typing_delay_min: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        typing_delay_max: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        action_delay_min: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        action_delay_max: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
        session_warming_enabled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        rotate_user_agent: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        country: z.ZodString;
        product: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        carrier: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        order_id: z.ZodString;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        enabled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        five_sim_api_key: z.ZodOptional<z.ZodOptional<z.ZodString>>;
        max_retries: z.ZodOptional<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        proxy_string: z.ZodString;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        enabled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
        free_proxy_enabled: z.ZodOptional<z.ZodOptional<z.ZodBoolean>>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        limit: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        format: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            json: "json";
            csv: "csv";
        }>>>;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        account_id: z.ZodString;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{}, z.core.$loose>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        api_key: z.ZodString;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
} | {
    name: string;
    title: string;
    description: string;
    inputSchema: z.ZodObject<{
        password: z.ZodString;
    }, z.core.$strip>;
    execute: (args: any) => Promise<{
        content: {
            type: "text";
            text: string;
        }[];
    }>;
})[];
