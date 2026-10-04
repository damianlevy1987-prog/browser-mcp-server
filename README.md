# Browser MCP Server

Advanced MCP (Model Context Protocol) server for browser automation with anti-detection, phone verification bypass, proxy management, and account tracking.

## Features

### 🚀 Advanced Anti-Detection System
- **Human-like Typing Simulation** - Random delays between keystrokes (0.1-0.3s)
- **Session Warming** - Pre-browsing Google, BBC, Wikipedia, YouTube to appear human
- **Random User Agents** - Rotates browser fingerprints for each account
- **Natural Delays** - Random wait times between actions (0.5-1.2s)
- **Navigator Property Modification** - Hides automation signatures
- **Realistic Name Generation** - Uses names from external file for authenticity

### 🔒 Phone Verification Bypass
- **Multiple Skip Strategies** - Automatically detects and clicks skip buttons
- **Alternative Method Detection** - Tries "Try another way" options
- **5sim API Integration** - Automatic phone number purchase and SMS code retrieval
- **Smart Retry Logic** - Multiple fallback strategies if one fails
- **Multi-language Support** - Works with English and Arabic skip buttons

### 🌐 Smart Proxy Integration
- **Built-in Proxy Support** - FreeProxy integration for IP rotation
- **Automatic Proxy Selection** - Random proxy selection for each account
- **Proxy Validation** - Ensures proxy is working before use

### 📊 Detailed Statistics
- **Total Accounts Created** - Track all created accounts
- **Active Accounts Count** - Monitor account status
- **Success Rate Percentage** - Calculate creation success rate
- **Last Creation Timestamp** - Track recent activity
- **Account Details** - View all saved account information

### 💾 Auto-Save Accounts
- **JSON Format Storage** - Structured account data storage
- **Automatic Backup** - Accounts saved immediately after creation
- **Account Metadata** - Includes email, password, creation date, status
- **Easy Export** - Simple JSON format for easy data export

### 🔄 Auto-Retry on Failure
- **Robust Error Handling** - Multiple retry attempts on failure
- **Element Detection** - Multiple selector strategies for finding elements
- **Page Load Retry** - Retries page loading if initial attempt fails
- **Smart Fallbacks** - Alternative methods if primary method fails

### ⚡ Lightning Fast Creation
- **Optimized Performance** - Efficient code for fast execution
- **Minimal Resource Usage** - Lightweight and efficient
- **Quick Browser Setup** - Fast Chrome driver initialization

### 🔐 Secure Configuration
- **Separate Config Files** - Easy to obfuscate main script while keeping configs editable
- **Password Protection** - Secure password storage in separate file
- **API Key Management** - Secure API key storage
- **No Hardcoded Secrets** - All sensitive data in external files

### 🎯 Additional Features
- **Custom User Agents** - Support for custom user agent lists
- **Custom Names Database** - Use your own name lists
- **Birthday Configuration** - Customizable birthday settings
- **Gender Selection** - Support for Male, Female, Other
- **Multi-language Support** - Works with English and Arabic interfaces
- **ChromeDriver Auto-Management** - Automatic ChromeDriver download and setup

## Supported Browsers

| Browser | Engine | Status |
|---------|--------|--------|
| Firefox | Gecko | ✅ Working |
| Chromium | Blink | ✅ Working |
| Edge | Blink (Chromium) | ✅ Working |
| Safari | WebKit | ❌ Needs system deps |
| Tor | Firefox + SOCKS | ✅ Working |

## Installation

### Via npm (Recommended)

```bash
# Install globally
npm install -g @browser-mcp/server

# Or install locally in your project
npm install @browser-mcp/server
```

After installation, install Playwright browsers:

```bash
npx playwright install firefox chromium
```

### From Source

```bash
git clone https://github.com/damianlevy1987-prog/browser-mcp-server.git
cd browser-mcp-server

# Install dependencies
npm install

# Build TypeScript
npm run build

# Install Playwright browsers
npx playwright install firefox chromium
```

## Usage

### Create Single Account

```bash
python3 gmail_account_creator.py --mode=create --count=1
```

### Create Multiple Accounts

```bash
python3 gmail_account_creator.py --mode=create --count=5
```

### With Proxy

```bash
# Auto-fetch proxies
python3 gmail_account_creator.py --mode=create --proxy-auto

# Use specific proxy
python3 gmail_account_creator.py --mode=create --proxy="http://ip:port"
```

### Check Status

```bash
python3 gmail_account_creator.py --mode=status
```

### Export Accounts

```bash
# JSON format
python3 gmail_account_creator.py --mode=export --format=json --output=accounts.json

# CSV format
python3 gmail_account_creator.py --mode=export --format=csv --output=accounts.csv
```

### Get Statistics

```bash
python3 gmail_account_creator.py --mode=stats
```

### Check Browser Availability

```bash
python3 gmail_account_creator.py --mode=availability
```

## Project Structure

```
browser-mcp-server/
├── gmail_account_creator.py    # Main script (anti-detect, phone verify, proxy, accounts)
├── requirements.txt            # Python dependencies
├── data/
│   ├── accounts/               # Saved accounts (auto-created)
│   │   ├── accounts.json       # Current accounts
│   │   └── backups/            # Timestamped backups
│   └── names.txt               # Names database
├── config/                     # Configuration directory
│   ├── config.json             # Main configuration
│   └── secure.json             # Secure settings (0600 permissions)
├── src/                        # TypeScript MCP server source
│   ├── index.ts                # Server entry point
│   ├── browser-manager.ts      # Core browser management
│   ├── anti-detection.ts       # Anti-detection system
│   ├── phone-verification.ts   # Phone verification bypass
│   ├── proxy-manager.ts        # Proxy integration
│   ├── account-manager.ts      # Account tracking
│   ├── config-manager.ts       # Configuration management
│   ├── tools.ts                # 47 MCP tools
│   └── types.ts                # TypeScript definitions
├── package.json                # Node.js dependencies
├── tsconfig.json               # TypeScript configuration
├── .gitignore                  # Git ignore rules
└── README.md                   # This file
```

## MCP Server (TypeScript)

The project also includes a full TypeScript MCP server with HTTP/SSE transport for internet access:

```bash
# Build the TypeScript server
cd src && npm install && npx tsc

# Run the server
node dist/index.js sse 3100
```

### Available Endpoints

- `GET /health` - Health check
- `POST /mcp` - Streamable HTTP (recommended)
- `GET /sse` - SSE transport
- `POST /messages` - Legacy messages

## Configuration

Edit `config/config.json` for main settings:

```json
{
  "anti_detection": {
    "enabled": true,
    "typing_delay_min": 100,
    "typing_delay_max": 300,
    "action_delay_min": 500,
    "action_delay_max": 1200,
    "session_warming_enabled": true,
    "rotate_user_agent": true
  },
  "phone_verification": {
    "enabled": false,
    "max_retries": 3,
    "retry_delay": 2000
  },
  "proxy": {
    "enabled": false,
    "free_proxy_enabled": true
  }
}
```

For secure settings (API keys, passwords), edit `config/secure.json`:

```json
{
  "api_key": "your_5sim_api_key",
  "password": "your_secure_password"
}
```

## Troubleshooting

### WebKit/Safari Not Available

If WebKit fails to launch due to missing library dependencies:

```bash
# On Debian/Kali systems, create symlinks for older library versions
sudo ln -sf /usr/lib/x86_64-linux-gnu/libicudata.so.72 /usr/lib/x86_64-linux-gnu/libicudata.so.74
sudo ln -sf /usr/lib/x86_64-linux-gnu/libicuuc.so.72 /usr/lib/x86_64-linux-gnu/libicuuc.so.74
sudo ln -sf /usr/lib/x86_64-linux-gnu/libxml2.so.16 /usr/lib/x86_64-linux-gnu/libxml2.so.2
sudo ln -sf /usr/lib/x86_64-linux-gnu/libjpeg.so.62 /usr/lib/x86_64-linux-gnu/libjpeg.so.8
```

Or install newer Ubuntu/Debian packages that include libjpeg-turbo 8.

### No Internet Connection for Proxies

Set `proxy.enabled` to `false` in config.json or provide a specific proxy URL via command line.

## License

MIT License - feel free to use for any purpose.

## Credits

Built with [Playwright](https://playwright.dev/) for browser automation and [MCP SDK](https://modelcontextprotocol.io/) for AI integration.
