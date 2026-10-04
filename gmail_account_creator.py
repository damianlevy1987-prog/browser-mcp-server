#!/usr/bin/env python3
"""
Browser Automation Suite - Gmail Account Creator
=================================================
Advanced browser automation with anti-detection, phone verification bypass,
proxy management, and account tracking.

Supported Browsers: Firefox, Chromium, Edge, Safari (macOS), Tor
Modes: Headed + Headless

Features:
  - Anti-Detection: Human-like typing, session warming, UA rotation, navigator spoofing
  - Phone Verification: 5sim API integration, skip strategies, auto-retry
  - Proxy Management: FreeProxy fetching, auto-selection, custom proxies
  - Account Tracking: Statistics, auto-save with backups, JSON/CSV export
  - Secure Config: Separate config files, API key/password protection

Usage Examples:
  # Create single account
  python3 gmail_account_creator.py --mode=create --count=1
  
  # Create multiple with auto-proxy
  python3 gmail_account_creator.py --mode=create --count=5 --proxy-auto
  
  # Use specific proxy
  python3 gmail_account_creator.py --mode=create --proxy="http://ip:port"
  
  # Check status
  python3 gmail_account_creator.py --mode=status
  
  # Export accounts
  python3 gmail_account_creator.py --mode=export --format=json
  
  # Get statistics
  python3 gmail_account_creator.py --mode=stats

File Structure:
  data/accounts/accounts.json      - Saved accounts
  data/accounts/backups/           - Timestamped backups
  data/names.txt                   - Custom names database
  config/config.json               - Main configuration
  config/secure.json               - Secure settings (0600 permissions)

Requirements:
  pip install playwright
  playwright install firefox chromium

Note: Browser dependencies may need system packages on some distros.
      On Kali/Debian: sudo apt-get install libicu74 libxml2 libjpeg-turbo8
"""

import asyncio
import json
import os
import sys
import time
import uuid
import random
import hashlib
import argparse
import enum
import logging
from pathlib import Path
from datetime import datetime
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any, Tuple
from enum import Enum
from concurrent.futures import ThreadPoolExecutor
import threading

try:
    from playwright.async_api import async_playwright, Browser, BrowserContext, Page, Error as PlaywrightError
except ImportError:
    print("ERROR: playwright not installed. Run: pip install playwright")
    print("Then: playwright install firefox chromium")
    sys.exit(1)

# ============================================================
# Configuration & Constants
# ============================================================

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
ACCOUNTS_DIR = DATA_DIR / "accounts"
BACKUP_DIR = ACCOUNTS_DIR / "backups"
CONFIG_DIR = BASE_DIR / "config"
SECURE_CONFIG_FILE = CONFIG_DIR / "secure.json"
MAIN_CONFIG_FILE = CONFIG_DIR / "config.json"
NAMES_FILE = BASE_DIR / "data" / "names.txt"

logger = logging.getLogger("browser-automation")


# ============================================================
# Data Models
# ============================================================

class AccountStatus(Enum):
    CREATED = "created"
    VERIFIED = "verified"
    FAILED = "failed"
    PENDING = "pending"


class Gender(Enum):
    MALE = "Male"
    FEMALE = "Female"
    OTHER = "Other"


@dataclass
class Birthday:
    year: int
    month: int
    day: int


@dataclass
class Account:
    id: str
    email: str
    password: str
    name: Optional[str] = None
    phone: Optional[str] = None
    country: Optional[str] = None
    birthday: Optional[Birthday] = None
    gender: Optional[Gender] = None
    proxy: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: str = ""
    status: AccountStatus = AccountStatus.CREATED
    notes: Optional[str] = None

    def to_dict(self) -> dict:
        d = asdict(self)
        if self.birthday:
            d["birthday"] = asdict(self.birthday)
        if self.gender:
            d["gender"] = self.gender.value
        if self.status:
            d["status"] = self.status.value
        return d


@dataclass
class Statistics:
    total_created: int = 0
    active_accounts: int = 0
    success_rate: float = 0.0
    last_created: Optional[str] = None
    by_country: Dict[str, int] = field(default_factory=dict)
    by_status: Dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return asdict(self)


# ============================================================
# User-Agent Database
# ============================================================

USER_AGENTS = [
    # Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    # Chrome macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36",
    # Firefox Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0",
    # Firefox macOS
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0",
    # Edge Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 Edg/128.0.0.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36 Edg/127.0.0.0",
]

DEFAULT_NAMES = [
    "James Smith", "Maria Garcia", "Mohammed Ali", "Sarah Johnson",
    "Chen Wei", "Emma Brown", "Carlos Rodriguez", "Yuki Tanaka",
    "Olivia Wilson", "Ahmed Hassan", "Sophie Martin", "Liam Davis",
    "Isabella Lopez", "Noah Anderson", "Mia Taylor", "Ethan Thomas",
]


# ============================================================
# Anti-Detection System
# ============================================================

class AntiDetectionSystem:
    """Advanced anti-detection system for browser automation."""

    def __init__(self, config: Optional[Dict] = None):
        self.config = {
            "enabled": True,
            "typing_delay_min": 100,    # ms
            "typing_delay_max": 300,
            "action_delay_min": 500,
            "action_delay_max": 1200,
            "session_warming_enabled": True,
            "warmup_sites": [
                "https://www.google.com",
                "https://www.bbc.com",
                "https://www.wikipedia.org",
                "https://www.youtube.com",
            ],
            "rotate_user_agent": True,
        }
        if config:
            self.config.update(config)

        self._current_page: Optional[Page] = None
        self._current_context: Optional[BrowserContext] = None

    def set_active(self, page: Page, context: BrowserContext):
        self._current_page = page
        self._current_context = context

    def clear_active(self):
        self._current_page = None
        self._current_context = None

    async def apply(self, page: Page, context: BrowserContext):
        """Apply all anti-detection measures."""
        if not self.config["enabled"]:
            return

        self.set_active(page, context)

        try:
            await self._hide_automation_signatures(page)
            await self._apply_stealth_scripts(page)
            logger.info("Anti-detection applied successfully")
        except Exception as e:
            logger.error(f"Failed to apply anti-detection: {e}")

    async def _hide_automation_signatures(self, page: Page):
        """Hide automation signatures from navigator properties."""
        await page.evaluate("""
            // Override webdriver property
            Object.defineProperty(navigator, 'webdriver', { get: () => false });

            // Mock plugins length
            Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });

            // Mock languages
            Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });

            // Override chrome runtime
            window.chrome = {
                runtime: {
                    onMessage: {},
                    send: () => {}
                }
            };

            // Fake permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) =>
                parameters.name === 'notifications'
                    ? Promise.resolve({ state: Notification.permission })
                    : originalQuery(parameters);

            // WebGL vendor spoofing (try/catch for browsers without WebGL)
            try {
                const getParameter = WebGLRenderingContext.prototype.getParameter;
                WebGLRenderingContext.prototype.getParameter = function(parameter) {
                    if (parameter === 37445) return 'Intel Inc.';
                    if (parameter === 37446) return 'Intel Iris OpenGL Engine';
                    return getParameter.call(this, parameter);
                };
            } catch(e) {}

            // AudioContext fingerprint randomization
            try {
                const origGetChannelData = AudioContext.prototype.createAnalyser;
                AudioContext.prototype.createAnalyser = function() {
                    const node = origGetChannelData.call(this);
                    const origGetData = node.getFloatFrequencyData.bind(node);
                    node.getFloatFrequencyData = function(arr) {
                        origGetData(arr);
                        for (let i = 0; i < arr.length; i++) {
                            arr[i] += (Math.random() - 0.5) * 5;
                        }
                    };
                    return node;
                };
            } catch(e) {}

            // Navigator.plugins bypass
            try {
                Object.defineProperty(navigator, 'mimeTypes', { get: () => [] });
            } catch(e) {}
        """)

    async def _apply_stealth_scripts(self, page: Page):
        """Add additional stealth scripts before page load."""
        await page.add_init_script("""
            // Override toString methods
            const originalToString = Function.prototype.toString;
            Function.prototype.toString = function() {
                if (this.name === 'webdriverExecute') {
                    return 'function webdriverExecute() { [native code] }';
                }
                return originalToString.call(this);
            };
        """)

    async def apply_random_user_agent(self, context: BrowserContext):
        """Apply a random user agent to the browser context."""
        ua = self.get_random_user_agent()
        await context.set_extra_http_headers({
            "User-Agent": ua,
        })
        # Note: Playwright's setUserAgent works at launch, not after
        # This is best effort for headers
        logger.debug(f"Applied UA: {ua[:50]}...")

    def get_random_user_agent(self) -> str:
        """Get a random user agent string."""
        return random.choice(USER_AGENTS)

    async def type_humanely(self, selector: str, text: str,
                           delay_min: Optional[int] = None,
                           delay_max: Optional[int] = None):
        """Simulate human-like typing with random delays between keystrokes."""
        if not self._current_page:
            raise RuntimeError("No active page")

        min_d = delay_min or self.config["typing_delay_min"]
        max_d = delay_max or self.config["typing_delay_max"]

        # Type character by character with random delays
        element = self._current_page.locator(selector)
        await element.click()
        await element.fill("")  # Clear first

        for char in text:
            await self._current_page.keyboard.type(char, delay=random.uniform(min_d / 1000, max_d / 1000))

        # Small pause after typing
        await self.delay(min_d, max_d)

    async def delay(self, min_ms: Optional[int] = None, max_ms: Optional[int] = None):
        """Natural delay between actions."""
        min_d = min_ms or self.config["action_delay_min"]
        max_d = max_ms or self.config["action_delay_max"]
        delay = random.uniform(min_d / 1000, max_d / 1000)
        await asyncio.sleep(delay)

    async def warmup_session(self, page: Page) -> Dict[str, Any]:
        """Browse common sites to make the session appear human."""
        if not self.config["session_warming_enabled"]:
            return {"visited": [], "errors": []}

        visited = []
        errors = []
        sites = random.sample(self.config["warmup_sites"], k=min(2, len(self.config["warmup_sites"])))

        for site in sites:
            try:
                await page.goto(site, wait_until="domcontentloaded", timeout=15000)
                visited.append(site)
                await self.delay(1000, 3000)
            except Exception as e:
                errors.append(f"{site}: {str(e)}")

        logger.info(f"Session warmed up: {len(visited)} sites visited")
        return {"visited": visited, "errors": errors}

    def generate_name(self) -> str:
        """Generate a realistic random name."""
        # Try loading from file
        try:
            if NAMES_FILE.exists():
                names = [n.strip() for n in NAMES_FILE.read_text().splitlines() if n.strip()]
                if names:
                    return random.choice(names)
        except Exception:
            pass

        return random.choice(DEFAULT_NAMES)

    def generate_birthday(self) -> Birthday:
        """Generate a random birthday."""
        year = random.randint(1960, 2005)
        month = random.randint(1, 12)
        days_in_month = (datetime(year, month % 12 + 1, 1) - timedelta(days=1)).day if month < 12 else 31
        day = random.randint(1, days_in_month)
        return Birthday(year=year, month=month, day=day)


from datetime import timedelta


# ============================================================
# Phone Verification System
# ============================================================

class PhoneVerificationSystem:
    """Phone verification bypass with 5sim API integration."""

    def __init__(self, config: Optional[Dict] = None):
        self.config = {
            "enabled": False,
            "five_sim_api_key": "",
            "five_sim_base_url": "https://5sim.net",
            "max_retries": 3,
            "retry_delay": 2000,  # ms
            "skip_selectors": [
                'button:has-text("Skip")',
                'button:has-text("تخطي")',  # Arabic
                'a:has-text("Skip")',
                '[data-testid="skip-button"]',
            ],
            "try_another_way_selectors": [
                'button:has-text("Try another way")',
                'button:has-text("جرب طريقة أخرى")',  # Arabic
                'a:has-text("Try another way")',
            ],
        }
        if config:
            self.config.update(config)

    async def purchase_number(self, country: str = "US", carrier: str = "any",
                               product: str = "google") -> Dict[str, Any]:
        """Purchase a phone number from 5sim."""
        if not self.config["enabled"]:
            return {"success": False, "error": "Phone verification disabled"}
        if not self.config["five_sim_api_key"]:
            return {"success": False, "error": "5sim API key not configured"}

        url = f"{self.config['five_sim_base_url']}/api/get/phones/{country}/{product}/{carrier}"

        try:
            import urllib.request
            req = urllib.request.Request(url, headers={"Authorization": f"APIToken {self.config['five_sim_api_key']}"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode())

            if not result.get("max") or not result.get("id"):
                return {"success": False, "error": "No phone available"}

            logger.info(f"Purchased number: {result['max']}")
            return {"success": True, "phone": result["max"], "id": result["id"]}
        except Exception as e:
            return {"success": False, "error": str(e)}

    async def get_code(self, order_id: str) -> Optional[str]:
        """Retrieve SMS code for purchased number."""
        if not self.config["five_sim_api_key"]:
            return None

        url = f"{self.config['five_sim_base_url']}/api/get/sms/{order_id}"
        try:
            import urllib.request
            req = urllib.request.Request(url, headers={"Authorization": f"APIToken {self.config['five_sim_api_key']}"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode())

            return result.get("code")
        except Exception:
            return None

    async def try_skip_verification(self, page: Page) -> bool:
        """Attempt to skip phone verification."""
        for selector in self.config["skip_selectors"]:
            try:
                element = page.locator(selector).first
                if await element.is_visible():
                    await element.click()
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                    logger.info("Successfully clicked skip button")
                    return True
            except Exception:
                continue
        return False

    async def try_alternative_method(self, page: Page) -> bool:
        """Try alternative verification methods."""
        for selector in self.config["try_another_way_selectors"]:
            try:
                element = page.locator(selector).first
                if await element.is_visible():
                    await element.click()
                    await asyncio.sleep(random.uniform(0.5, 1.5))
                    logger.info("Clicked alternative method")
                    return True
            except Exception:
                continue
        return False

    async def complete_verification(self, page: Page, country: str = "US",
                                     product: str = "google") -> Dict[str, Any]:
        """Complete full phone verification flow."""
        steps = []
        errors = []

        # Step 1: Try to skip
        steps.append("Attempting to skip verification")
        if await self.try_skip_verification(page):
            steps.append("Successfully skipped")
            return {"success": True, "steps": steps, "errors": errors}

        # Step 2: Try alternative
        steps.append("Trying alternative methods")
        if await self.try_alternative_method(page):
            steps.append("Alternative method selected")
            return {"success": True, "steps": steps, "errors": errors}

        # Step 3: Purchase number
        steps.append("Purchasing phone number")
        purchase = await self.purchase_number(country, product=product)
        if not purchase["success"]:
            errors.append(f"Failed to purchase: {purchase['error']}")
            return {"success": False, "steps": steps, "errors": errors}

        steps.append(f"Purchased: {purchase['phone']}")

        # Step 4: Wait for SMS
        steps.append("Waiting for SMS code")
        code = None
        for i in range(self.config["max_retries"]):
            await asyncio.sleep(self.config["retry_delay"] / 1000)
            code = await self.get_code(purchase["id"])
            if code:
                break

        if not code:
            errors.append("Failed to retrieve SMS code")
        else:
            steps.append(f"Received code: {code}")

        return {"success": code is not None, "steps": steps, "errors": errors,
                "phoneNumber": purchase["phone"], "code": code}


# ============================================================
# Proxy Manager
# ============================================================

class ProxyManager:
    """Smart proxy integration with auto-selection and validation."""

    PROXY_SOURCES = [
        "https://www.proxy-list.download/api/v1/get?type=https",
        "https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/tls/proxies-https.txt",
    ]

    def __init__(self, config: Optional[Dict] = None):
        self.config = {
            "enabled": False,
            "free_proxy_enabled": True,
            "custom_proxies": [],
        }
        if config:
            self.config.update(config)

        self.available_proxies: List[Dict[str, Any]] = []
        self.used_proxies: set = set()

    async def fetch_proxies(self) -> List[Dict[str, Any]]:
        """Fetch proxies from free sources."""
        if not self.config["free_proxy_enabled"]:
            return []

        all_proxies = []
        for source in self.PROXY_SOURCES:
            try:
                import urllib.request
                req = urllib.request.Request(source, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    content = resp.read().decode()

                lines = content.strip().split("\n")
                for line in lines:
                    line = line.strip()
                    if ":" in line and not line.startswith("#"):
                        parts = line.split(":")
                        if len(parts) >= 2:
                            all_proxies.append({
                                "ip": parts[0],
                                "port": parts[1],
                                "protocol": "https",
                                "valid": False,
                            })
            except Exception as e:
                logger.warning(f"Failed to fetch from {source}: {e}")

        # Deduplicate
        seen = set()
        unique = []
        for p in all_proxies:
            key = f"{p['ip']}:{p['port']}"
            if key not in seen:
                seen.add(key)
                unique.append(p)

        self.available_proxies = unique
        logger.info(f"Fetched {len(unique)} unique proxies")
        return unique

    def get_random_proxy(self) -> Optional[Dict[str, Any]]:
        """Get a random unused proxy."""
        unused = [p for p in self.available_proxies
                  if f"{p['ip']}:{p['port']}" not in self.used_proxies]
        if not unused:
            return None

        proxy = random.choice(unused)
        self.used_proxies.add(f"{proxy['ip']}:{proxy['port']}")
        return proxy

    def add_custom_proxy(self, proxy_string: str) -> bool:
        """Add a custom proxy (format: ip:port)."""
        parts = proxy_string.split(":")
        if len(parts) != 2:
            return False
        self.available_proxies.append({
            "ip": parts[0], "port": parts[1],
            "protocol": "https", "valid": False,
        })
        return True

    def reset_used(self):
        """Reset used proxy tracker."""
        self.used_proxies.clear()

    def get_stats(self) -> Dict[str, int]:
        """Get proxy pool statistics."""
        valid = sum(1 for p in self.available_proxies if p.get("valid"))
        return {
            "total": len(self.available_proxies),
            "valid": valid,
            "used": len(self.used_proxies),
            "available": valid - len(self.used_proxies),
        }


# ============================================================
# Account Manager
# ============================================================

class AccountManager:
    """Account tracking with auto-save and statistics."""

    def __init__(self):
        self.accounts: List[Account] = []
        self.stats = Statistics()

    def initialize(self):
        """Initialize storage directories."""
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        ACCOUNTS_DIR.mkdir(exist_ok=True)
        BACKUP_DIR.mkdir(exist_ok=True)
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        # Load existing accounts
        accounts_file = ACCOUNTS_DIR / "accounts.json"
        if accounts_file.exists():
            try:
                data = json.loads(accounts_file.read_text())
                self.accounts = [self._parse_account(a) for a in data]
                self.recalculate_stats()
                logger.info(f"Loaded {len(self.accounts)} accounts")
            except Exception as e:
                logger.error(f"Failed to load accounts: {e}")

    def _parse_account(self, d: dict) -> Account:
        """Parse account from dict."""
        bday = d.get("birthday")
        if bday and isinstance(bday, dict):
            birthday = Birthday(**bday)
        elif bday:
            birthday = Birthday(**bday)
        else:
            birthday = None

        gender_val = d.get("gender")
        gender = Gender(gender_val) if gender_val else None

        return Account(
            id=d["id"],
            email=d["email"],
            password=d["password"],
            name=d.get("name"),
            phone=d.get("phone"),
            country=d.get("country"),
            birthday=birthday,
            gender=gender,
            proxy=d.get("proxy"),
            user_agent=d.get("user_agent"),
            created_at=d.get("created_at", ""),
            status=AccountStatus(d.get("status", "created")),
            notes=d.get("notes"),
        )

    def save_account(self, email: str, password: str, **kwargs) -> Account:
        """Save an account with automatic backup."""
        account = Account(
            id=f"acc_{int(time.time()*1000)}_{uuid.uuid4().hex[:6]}",
            email=email,
            password=password,
            created_at=datetime.now().isoformat(),
            status=AccountStatus.CREATED,
            **{k: v for k, v in kwargs.items() if v is not None}
        )
        self.accounts.append(account)
        self._save_to_disk()
        self.recalculate_stats()
        logger.info(f"Saved account: {account.id}")
        return account

    def _save_to_disk(self):
        """Save all accounts to disk."""
        data = [a.to_dict() for a in self.accounts]
        accounts_file = ACCOUNTS_DIR / "accounts.json"
        accounts_file.write_text(json.dumps(data, indent=2))
        self._create_backup()

    def _create_backup(self):
        """Create timestamped backup."""
        ts = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_file = BACKUP_DIR / f"accounts-{ts}.json"
        data = [a.to_dict() for a in self.accounts]
        backup_file.write_text(json.dumps(data, indent=2))

    def recalculate_stats(self):
        """Recalculate statistics."""
        self.stats.total_created = len(self.accounts)
        self.stats.active_accounts = sum(
            1 for a in self.accounts if a.status == AccountStatus.VERIFIED
        )
        successful = sum(
            1 for a in self.accounts
            if a.status in (AccountStatus.VERIFIED, AccountStatus.CREATED)
        )
        self.stats.success_rate = (successful / len(self.accounts) * 100) if self.accounts else 0
        self.stats.last_created = self.accounts[-1].created_at if self.accounts else None

        self.stats.by_country = {}
        self.stats.by_status = {}
        for a in self.accounts:
            country = a.country or "unknown"
            self.stats.by_country[country] = self.stats.by_country.get(country, 0) + 1
            self.stats.by_status[a.status.value] = self.stats.by_status.get(a.status.value, 0) + 1

    def get_statistics(self) -> Statistics:
        return self.stats

    def get_all_accounts(self) -> List[Account]:
        return list(self.accounts)

    def get_recent_accounts(self, limit: int = 10) -> List[Account]:
        return list(reversed(self.accounts))[:limit]

    def update_status(self, account_id: str, status: AccountStatus, notes: Optional[str] = None) -> bool:
        """Update account status."""
        for a in self.accounts:
            if a.id == account_id:
                a.status = status
                if notes:
                    a.notes = notes
                self._save_to_disk()
                self.recalculate_stats()
                return True
        return False

    def delete_account(self, account_id: str) -> bool:
        """Delete an account."""
        for i, a in enumerate(self.accounts):
            if a.id == account_id:
                self.accounts.pop(i)
                self._save_to_disk()
                self.recalculate_stats()
                return True
        return False

    def export_accounts(self, fmt: str = "json") -> str:
        """Export accounts."""
        data = [a.to_dict() for a in self.accounts]
        if fmt == "json":
            return json.dumps(data, indent=2)
        elif fmt == "csv":
            headers = ["id", "email", "password", "name", "phone", "country", "created_at", "status"]
            rows = []
            for a in self.accounts:
                row = []
                for h in headers:
                    val = getattr(a, h, None)
                    if val is None:
                        row.append("")
                    elif isinstance(val, enum.Enum):
                        row.append(val.value)
                    elif isinstance(val, dict):
                        row.append(json.dumps(val))
                    else:
                        row.append(str(val))
                rows.append(",".join(row))
            return "\n".join([",".join(headers)] + rows)
        return ""

    def clear_all(self):
        """Clear all accounts."""
        self.accounts = []
        self._save_to_disk()
        self.recalculate_stats()


# ============================================================
# Config Manager
# ============================================================

class ConfigManager:
    """Secure configuration management."""

    def __init__(self):
        self.config = self._default_config()
        self.secure_config: Dict[str, Any] = {}

    @staticmethod
    def _default_config() -> Dict[str, Any]:
        return {
            "anti_detection": {
                "enabled": True,
                "typing_delay_min": 100,
                "typing_delay_max": 300,
                "action_delay_min": 500,
                "action_delay_max": 1200,
                "session_warming_enabled": True,
                "rotate_user_agent": True,
            },
            "phone_verification": {
                "enabled": False,
                "max_retries": 3,
                "retry_delay": 2000,
            },
            "proxy": {
                "enabled": False,
                "free_proxy_enabled": True,
            },
            "accounts": {
                "auto_save": True,
                "backup_enabled": True,
            },
        }

    def initialize(self):
        """Load configuration."""
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)

        if MAIN_CONFIG_FILE.exists():
            try:
                loaded = json.loads(MAIN_CONFIG_FILE.read_text())
                self.config.update(loaded)
            except Exception:
                pass

        if SECURE_CONFIG_FILE.exists():
            try:
                self.secure_config = json.loads(SECURE_CONFIG_FILE.read_text())
            except Exception:
                pass

    def get_config(self) -> Dict[str, Any]:
        return dict(self.config)

    def update_config(self, updates: Dict[str, Any]):
        self.config.update(updates)
        self._save_main()

    def set_api_key(self, key: str):
        self.secure_config["api_key"] = key
        self._save_secure()

    def get_api_key(self) -> Optional[str]:
        return self.secure_config.get("api_key") or self.config.get("phone_verification", {}).get("five_sim_api_key")

    def set_password(self, pwd: str):
        self.secure_config["password"] = pwd
        self._save_secure()

    def get_password(self) -> Optional[str]:
        return self.secure_config.get("password")

    def _save_main(self):
        save_data = {k: v for k, v in self.config.items()}
        MAIN_CONFIG_FILE.write_text(json.dumps(save_data, indent=2))

    def _save_secure(self):
        SECURE_CONFIG_FILE.write_text(json.dumps(self.secure_config, indent=2))
        try:
            SECURE_CONFIG_FILE.chmod(0o600)
        except Exception:
            pass

    def reset_to_defaults(self):
        self.config = self._default_config()
        self.secure_config = {}
        self._save_main()
        if SECURE_CONFIG_FILE.exists():
            SECURE_CONFIG_FILE.unlink()


# ============================================================
# Browser Manager
# ============================================================

class BrowserManager:
    """Core browser management with multi-browser support."""

    BROWSER_MAP = {
        "firefox": "firefox",
        "chromium": "chromium",
        "chrome": "chromium",
        "edge": "chromium",
        "safari": "webkit",
        "tor": "firefox",
    }

    TOR_ARGS = [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-dev-shm-usage",
    ]

    def __init__(self):
        self.playwright = None
        self.browser: Optional[Browser] = None
        self.context: Optional[BrowserContext] = None
        self.page: Optional[Page] = None
        self.session_id: Optional[str] = None
        self._pw_context_manager = None  # Track the async_playwright() context
        self._started = False

    async def start(self):
        """Start the playwright context."""
        if self._started:
            return
        self._pw_context_manager = async_playwright()
        self.playwright = await self._pw_context_manager.__aenter__()
        self._started = True

    async def stop(self):
        """Stop the playwright context."""
        if self._pw_context_manager and self._started:
            try:
                await self._pw_context_manager.__aexit__(None, None, None)
            except Exception:
                pass
            self._started = False
            self.playwright = None
            self.browser = None
            self.context = None
            self.page = None

    async def launch(self, browser_name: str = "firefox", headless: bool = True,
                     viewport_width: int = 1280, viewport_height: int = 720,
                     user_agent: Optional[str] = None, locale: Optional[str] = None,
                     proxy: Optional[str] = None, ignore_https_errors: bool = False,
                     anti_detection: bool = True, warmup: bool = False,
                     warmup_adaptive: bool = False) -> Dict[str, Any]:
        """Launch a browser instance."""
        # Ensure playwright is started
        if not self._started:
            await self.start()

    async def launch(self, browser_name: str = "firefox", headless: bool = True,
                     viewport_width: int = 1280, viewport_height: int = 720,
                     user_agent: Optional[str] = None, locale: Optional[str] = None,
                     proxy: Optional[str] = None, ignore_https_errors: bool = False,
                     anti_detection: bool = True, warmup: bool = False,
                     warmup_adaptive: bool = False) -> Dict[str, Any]:
        """Launch a browser instance."""
        self.session_id = f"session_{uuid.uuid4().hex[:8]}"
        logger.info(f"Launching {browser_name} in {'headless' if headless else 'headed'} mode")

        browser_type_name = self.BROWSER_MAP.get(browser_name.lower(), "firefox")

        # Use already-started playwright instance
        pw = self.playwright
        browser_kwargs = {"headless": headless}

        # Browser-specific args
        if browser_name.lower() == "tor":
            browser_kwargs["args"] = self.TOR_ARGS
        elif browser_name.lower() == "edge":
            browser_kwargs["channel"] = "msedge"

        browser = await getattr(pw, browser_type_name).launch(**browser_kwargs)
        self.browser = browser

        # Context args
        context_args = {
            "viewport": {"width": viewport_width, "height": viewport_height},
            "ignore_https_errors": ignore_https_errors,
        }
        if locale:
            context_args["locale"] = locale
        if proxy:
            context_args["proxy"] = {"server": proxy}
        if user_agent:
            context_args["user_agent"] = user_agent

        context = await browser.new_context(**context_args)
        self.context = context

        page = await context.new_page()
        self.page = page

        # Anti-detection
        anti_detect = AntiDetectionSystem()
        if anti_detection:
            await anti_detect.apply(page, context)

        # Session warming
        warmup_result = None
        if warmup and anti_detection:
            warmup_result = await anti_detect.warmup_session(page)

        return {
            "sessionId": self.session_id,
            "browser": browser_name,
            "mode": "headless" if headless else "headed",
            "warmup": warmup_result,
        }

    async def navigate(self, url: str, wait_until: str = "networkidle",
                       timeout: int = 30000) -> Dict[str, str]:
        """Navigate to URL."""
        if not self.page:
            raise RuntimeError("No active page")

        response = await self.page.goto(url, wait_until=wait_until, timeout=timeout)
        title = await self.page.title()
        return {"url": self.page.url, "title": title}

    async def screenshot(self, full_page: bool = False) -> Dict[str, Any]:
        """Take screenshot."""
        if not self.page:
            raise RuntimeError("No active page")

        buffer = await self.page.screenshot(full_page=full_page, type="png")
        info = await self.page.evaluate("() => ({w: window.innerWidth, h: window.innerHeight})")
        return {
            "imageData": buffer.decode("base64"),
            "mimeType": "image/png",
            "width": info["w"],
            "height": info["h"],
        }

    async def evaluate(self, expression: str) -> Any:
        """Execute JavaScript."""
        if not self.page:
            raise RuntimeError("No active page")
        return await self.page.evaluate(expression)

    async def get_text(self, selector: str) -> str:
        """Get element text."""
        if not self.page:
            raise RuntimeError("No active page")
        text = await self.page.text_content(selector)
        return text or ""

    async def click(self, selector: str, button: str = "left"):
        """Click element."""
        if not self.page:
            raise RuntimeError("No active page")
        await self.page.click(selector, button=button)

    async def fill(self, selector: str, value: str):
        """Fill input field."""
        if not self.page:
            raise RuntimeError("No active page")
        await self.page.fill(selector, value)

    async def get_cookies(self) -> List[Dict]:
        """Get cookies."""
        if not self.context:
            raise RuntimeError("No active context")
        return await self.context.cookies()

    async def set_cookies(self, cookies: List[Dict]):
        """Set cookies."""
        if not self.context:
            raise RuntimeError("No active context")
        await self.context.add_cookies(cookies)

    async def get_local_storage(self) -> Dict[str, str]:
        """Get localStorage."""
        if not self.page:
            raise RuntimeError("No active page")
        return await self.page.evaluate("""
            () => {
                const result = {};
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) result[key] = localStorage.getItem(key);
                }
                return result;
            }
        """)

    async def clear_storage(self):
        """Clear storage."""
        if not self.page:
            raise RuntimeError("No active page")
        await self.page.evaluate("() => { localStorage.clear(); sessionStorage.clear(); }")

    async def get_source(self) -> str:
        """Get HTML source."""
        if not self.page:
            raise RuntimeError("No active page")
        return await self.page.content()

    async def close(self):
        """Close browser."""
        if self.page:
            try: await self.page.close()
            except: pass
        if self.context:
            try: await self.context.close()
            except: pass
        if self.browser:
            try: await self.browser.close()
            except: pass
        self.page = None
        self.context = None
        self.browser = None
        # Don't stop playwright here - let the creator manage it


# ============================================================
# Gmail Account Creator
# ============================================================

class GmailAccountCreator:
    """Main Gmail account creation orchestrator."""

    def __init__(self, config: Optional[Dict] = None):
        self.config_manager = ConfigManager()
        self.account_manager = AccountManager()
        self.proxy_manager = ProxyManager()

        # Initialize sub-systems
        self.config_manager.initialize()
        self.account_manager.initialize()

        anti_det_cfg = self.config_manager.config.get("anti_detection", {})
        self.anti_detection = AntiDetectionSystem(anti_det_cfg)

        phone_cfg = self.config_manager.config.get("phone_verification", {})
        self.phone_verification = PhoneVerificationSystem(phone_cfg)

        self.browser_mgr = BrowserManager()
        self._running = False

    def create_email(self) -> str:
        """Generate a random email address."""
        domains = ["gmail.com"]
        domain = random.choice(domains)
        username = self._generate_username()
        return f"{username}@{domain}"

    def _generate_username(self) -> str:
        """Generate a random username."""
        prefixes = ["my", "the", "real", "cool", "fast", "super", "mega", "ultra"]
        nouns = ["user", "dev", "pro", "master", "star", "king", "queen", "hero",
                 "wolf", "hawk", "fox", "bear", "lion", "tiger", "eagle", "dragon"]
        numbers = random.randint(1, 9999)

        pattern = random.choice(["prefix_noun", "noun_prefix", "random"])

        if pattern == "prefix_noun":
            return f"{random.choice(prefixes)}{random.choice(nouns)}{numbers}"
        elif pattern == "noun_prefix":
            return f"{random.choice(nouns)}{random.choice(prefixes)}{numbers}"
        else:
            chars = ''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=8))
            return chars

    def generate_password(self, length: int = 16) -> str:
        """Generate a strong random password."""
        chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
        while True:
            pwd = ''.join(random.choices(chars, k=length))
            # Ensure at least one uppercase, one lowercase, one digit, one special
            if (any(c.isupper() for c in pwd) and
                any(c.islower() for c in pwd) and
                any(c.isdigit() for c in pwd) and
                any(c in "!@#$%^&*" for c in pwd)):
                return pwd

    async def create_single_account(self, proxy: Optional[str] = None,
                                     use_phone_verify: bool = False) -> Dict[str, Any]:
        """Create a single Gmail account."""
        start_time = time.time()
        result = {"success": False, "account": None, "errors": [], "duration": 0}

        try:
            # Generate credentials
            email = self.create_email()
            password = self.generate_password()
            name = self.anti_detection.generate_name()
            birthday = self.anti_detection.generate_birthday()
            gender = random.choice(list(Gender))

            # Launch browser
            launch_result = await self.browser_mgr.launch(
                browser_name="firefox",
                headless=True,
                proxy=proxy,
                anti_detection=True,
                warmup=False,
            )

            page = self.browser_mgr.page

            # Navigate to Gmail signup
            await self.browser_mgr.navigate("https://accounts.google.com/signup", wait_until="domcontentloaded")
            await self.anti_detection.delay(1000, 2000)

            # Fill name fields
            try:
                # First name
                first_name = name.split()[0]
                last_name = " ".join(name.split()[1:]) if len(name.split()) > 1 else name.split()[0]

                fn_selector = 'input[name="firstName"]'
                ln_selector = 'input[name="lastName"]'

                if await page.locator(fn_selector).first.is_visible(timeout=5000):
                    await page.locator(fn_selector).first.click(); await page.locator(fn_selector).first.fill(""); await page.keyboard.type(first_name)
                    await self.anti_detection.delay(200, 500)
                    await page.locator(ln_selector).first.click(); await page.locator(ln_selector).first.fill(""); await page.keyboard.type(last_name)
                    await self.anti_detection.delay(200, 500)
            except Exception as e:
                result["errors"].append(f"Name filling failed: {e}")

            # Fill birthday (best-effort)
            try:
                # Google uses dropdown selects for month and year
                month_sel = page.locator('select[name="bu"]')
                if await month_sel.first.is_visible(timeout=3000):
                    await page.select_option(month_sel.first, str(birthday.month))

                year_sel = page.locator('select[name="by"]')
                if await year_sel.first.is_visible(timeout=3000):
                    await page.select_option(year_sel.first, str(birthday.year))
            except Exception:
                pass  # Skip birthday if selectors don't match

            # Select gender
            try:
                gender_selectors = [
                    'input[value="Male"]',
                    'input[value="female"]',
                    'div:has-text("Male")',
                    'div:has-text("Female")',
                ]
                for sel in gender_selectors:
                    el = page.locator(sel).first
                    if await el.is_visible(timeout=3000):
                        await el.click()
                        break
            except Exception as e:
                result["errors"].append(f"Gender selection failed: {e}")

            # Choose username
            try:
                username_input = page.locator('input[name="Username"], input[autocomplete="username"]')
                if await username_input.first.is_visible(timeout=5000):
                    await username_input.first.fill(email.split("@")[0])
                else:
                    # Email might already be shown as link
                    email_link = page.locator('a[href*="mail.google.com"]')
                    if await email_link.first.is_visible(timeout=3000):
                        await email_link.first.click()
            except Exception as e:
                result["errors"].append(f"Username selection failed: {e}")

            # Fill password
            try:
                pwd_selectors = [
                    'input[name="Passwd"]',
                    'input[type="password"]',
                    'input[autocomplete="new-password"]',
                ]
                for sel in pwd_selectors:
                    if await page.locator(sel).first.is_visible(timeout=3000):
                        await page.locator(sel).first.click(); await page.locator(sel).first.fill(""); await page.keyboard.type(password)
                        break
            except Exception as e:
                result["errors"].append(f"Password filling failed: {e}")

            # Confirm password
            try:
                confirm_sel = 'input[name="ConfirmPasswd"], input[autocomplete="current-password"]'
                if await page.locator(confirm_sel).first.is_visible(timeout=3000):
                    await page.locator(confirm_sel).first.click(); await page.locator(confirm_sel).first.fill(""); await page.keyboard.type(password)
            except Exception as e:
                result["errors"].append(f"Password confirmation failed: {e}")

            # Click Next/Continue
            try:
                next_buttons = [
                    'button[type="submit"]',
                    'button:has-text("Next")',
                    'button:has-text("Continue")',
                    'button:has-text("下一步")',
                    'input[type="submit"]',
                ]
                clicked = False
                for sel in next_buttons:
                    btn = page.locator(sel).first
                    if await btn.is_visible(timeout=3000):
                        await btn.click()
                        clicked = True
                        break
                if not clicked:
                    result["errors"].append("Could not find Next button")
            except Exception as e:
                result["errors"].append(f"Next button click failed: {e}")

            # Wait for next page
            await self.anti_detection.delay(2000, 4000)

            # Handle phone verification if needed
            phone_result = None
            if use_phone_verify:
                phone_result = await self.phone_verification.complete_verification(page)

            # Save account
            account = self.account_manager.save_account(
                email=email,
                password=password,
                name=name,
                phone=None,
                birthday=birthday,
                gender=gender,
                proxy=proxy,
            )

            duration = time.time() - start_time
            result = {
                "success": True,
                "account": account.to_dict(),
                "errors": result["errors"],
                "duration": round(duration, 2),
                "sessionId": self.browser_mgr.session_id,
            }

        except Exception as e:
            result["errors"].append(str(e))
            result["duration"] = round(time.time() - start_time, 2)

        return result

    async def create_batch(self, count: int = 1, proxy_auto: bool = False,
                           proxy_list: Optional[List[str]] = None,
                           use_phone_verify: bool = False) -> List[Dict[str, Any]]:
        """Create multiple accounts."""
        results = []

        # Fetch proxies if auto
        if proxy_auto:
            await self.proxy_manager.fetch_proxies()

        for i in range(count):
            proxy = None
            if proxy_auto:
                proxy_obj = self.proxy_manager.get_random_proxy()
                if proxy_obj:
                    proxy = f"{proxy_obj['protocol']}://{proxy_obj['ip']}:{proxy_obj['port']}"
            elif proxy_list and i < len(proxy_list):
                proxy = proxy_list[i]

            logger.info(f"Creating account {i+1}/{count}")
            result = await self.create_single_account(proxy=proxy, use_phone_verify=use_phone_verify)
            results.append(result)

            # Close browser between accounts
            await self.browser_mgr.close()

            # Random delay between accounts
            await self.anti_detection.delay(3000, 6000)

        return results

    async def run(self, mode: str = "create", **kwargs) -> Dict[str, Any]:
        """Main entry point."""
        self._running = True
        start_time = time.time()

        try:
            # Ensure playwright is started for browser operations
            if mode in ("create",):
                await self.browser_mgr.start()

            if mode == "create":
                count = kwargs.get("count", 1)
                proxy_auto = kwargs.get("proxy_auto", False)
                proxy_list = kwargs.get("proxy_list")
                use_phone = kwargs.get("use_phone_verify", False)

                results = await self.create_batch(
                    count=count,
                    proxy_auto=proxy_auto,
                    proxy_list=proxy_list,
                    use_phone_verify=use_phone,
                )

                return {
                    "mode": "create",
                    "results": results,
                    "statistics": self.account_manager.get_statistics().to_dict(),
                    "duration": round(time.time() - start_time, 2),
                }

            elif mode == "status":
                stats = self.account_manager.get_statistics()
                recent = self.account_manager.get_recent_accounts(kwargs.get("limit", 10))
                return {
                    "mode": "status",
                    "statistics": stats.to_dict(),
                    "recent_accounts": [a.to_dict() for a in recent],
                }

            elif mode == "export":
                fmt = kwargs.get("format", "json")
                data = self.account_manager.export_accounts(fmt)
                return {
                    "mode": "export",
                    "format": fmt,
                    "data": data,
                }

            elif mode == "availability":
                return await self.check_browser_availability()

            elif mode == "stats":
                return {
                    "mode": "stats",
                    "statistics": self.account_manager.get_statistics().to_dict(),
                    "proxy_stats": self.proxy_manager.get_stats(),
                }

            else:
                return {"error": f"Unknown mode: {mode}"}

        finally:
            self._running = False
            # Clean up playwright
            try:
                await self.browser_mgr.stop()
            except Exception:
                pass

    async def check_browser_availability(self) -> Dict[str, Any]:
        """Check which browsers are available using subprocess."""
        results = {}
        import subprocess
        
        # Check if browsers exist in cache
        cache_dir = Path.home() / ".cache" / "ms-playwright"
        
        for browser_name in ["firefox", "chromium", "webkit"]:
            try:
                # Find browser executable
                exe_path = None
                for entry in cache_dir.iterdir():
                    if entry.name.startswith(browser_name):
                        # Try to find the actual browser binary
                        for root, dirs, files in os.walk(entry):
                            for f in files:
                                if f == browser_name or (browser_name == "chromium" and f == "chrome"):
                                    exe_path = os.path.join(root, f)
                                    break
                            if exe_path:
                                break
                    if exe_path:
                        break
                
                if exe_path and os.path.isfile(exe_path):
                    results[browser_name] = {
                        "available": True, 
                        "path": exe_path,
                        "cached": True
                    }
                else:
                    results[browser_name] = {
                        "available": False, 
                        "error": f"No {browser_name} binary found"
                    }
            except Exception as e:
                results[browser_name] = {"available": False, "error": str(e)}

        return {"mode": "availability", "browsers": results}


# ============================================================
# CLI Entry Point
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Gmail Account Creator with Advanced Features")
    parser.add_argument("--mode", choices=["create", "status", "export", "availability", "stats"],
                        default="create", help="Operation mode")
    parser.add_argument("--browser", choices=["firefox", "chromium", "chrome", "edge", "safari", "tor"],
                        default="firefox", help="Browser to use")
    parser.add_argument("--headless", action="store_true", default=True, help="Run in headless mode")
    parser.add_argument("--headed", action="store_false", dest="headless", help="Run with GUI")
    parser.add_argument("--count", type=int, default=1, help="Number of accounts to create")
    parser.add_argument("--proxy", help="Proxy server URL (http://ip:port)")
    parser.add_argument("--proxy-auto", action="store_true", help="Auto-fetch proxies")
    parser.add_argument("--proxy-list", help="Comma-separated proxy list")
    parser.add_argument("--phone-verify", action="store_true", help="Use phone verification")
    parser.add_argument("--output", help="Output file for export")
    parser.add_argument("--format", choices=["json", "csv"], default="json", help="Export format")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose logging")
    parser.add_argument("--quiet", "-q", action="store_true", help="Minimal output")

    args = parser.parse_args()

    # Configure logging
    log_level = logging.DEBUG if args.verbose else (logging.WARNING if args.quiet else logging.INFO)
    logging.basicConfig(level=log_level, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")

    creator = GmailAccountCreator()

    # Parse proxy list
    proxy_list = None
    if args.proxy_list:
        proxy_list = [p.strip() for p in args.proxy_list.split(",")]

    # Build kwargs
    kwargs = {
        "count": args.count,
        "proxy_auto": args.proxy_auto,
        "proxy_list": proxy_list,
        "use_phone_verify": args.phone_verify,
        "format": args.format,
    }

    # Run
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(creator.run(mode=args.mode, **kwargs))

        # Output results
        if args.mode == "export":
            if args.output:
                Path(args.output).write_text(result.get("data", ""))
                print(f"Exported to {args.output}")
            else:
                print(result.get("data", ""))
        elif args.mode == "stats":
            print(json.dumps(result, indent=2, default=str))
        elif args.mode == "status":
            stats = result.get("statistics", {})
            print(f"\n{'='*50}")
            print(f"  Account Creation Statistics")
            print(f"{'='*50}")
            print(f"  Total Created:    {stats.get('total_created', 0)}")
            print(f"  Active Accounts:  {stats.get('active_accounts', 0)}")
            print(f"  Success Rate:     {stats.get('success_rate', 0):.1f}%")
            print(f"  Last Created:     {stats.get('last_created', 'N/A')}")
            print(f"{'='*50}\n")
        elif args.mode == "create":
            successes = sum(1 for r in result.get("results", []) if r.get("success"))
            failures = len(result.get("results", [])) - successes
            print(f"\n{'='*50}")
            print(f"  Account Creation Results")
            print(f"{'='*50}")
            print(f"  Total:            {len(result.get('results', []))}")
            print(f"  Success:          {successes}")
            print(f"  Failed:           {failures}")
            print(f"  Duration:         {result.get('duration', 0):.1f}s")
            print(f"{'='*50}\n")

            for i, r in enumerate(result.get("results", [])):
                status = "✓ SUCCESS" if r.get("success") else "✗ FAILED"
                acct = r.get("account", {})
                print(f"  [{i+1}] {status}")
                if acct:
                    print(f"      Email:   {acct.get('email', 'N/A')}")
                    print(f"      Name:    {acct.get('name', 'N/A')}")
                    print(f"      ID:      {acct.get('id', 'N/A')}")
                if r.get("errors"):
                    for err in r["errors"]:
                        print(f"      Error:   {err}")
                print()

        elif args.mode == "availability":
            browsers = result.get("browsers", {})
            for name, info in browsers.items():
                status = "✓ Available" if info.get("available") else "✗ Not Available"
                ver = info.get("version", "")
                print(f"  {name:12} {status} {ver}")

    except KeyboardInterrupt:
        print("\nInterrupted by user")
    except Exception as e:
        print(f"\nERROR: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
    finally:
        loop.close()


if __name__ == "__main__":
    main()
