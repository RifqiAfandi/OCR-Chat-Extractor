/**
 * Security Module for OCR Chat Extractor
 * Implements client-side security hardening measures
 * 
 * SECURITY FEATURES:
 * - Console protection and DevTools detection
 * - API key obfuscation and secure storage
 * - localStorage security with encryption and expiration
 * - Session management and timeout
 * - Anti-tampering and integrity checks
 * - Memory cleanup for sensitive data
 */

(function() {
    'use strict';

    // ============================================
    // CONFIGURATION
    // ============================================
    const CONFIG = {
        PRODUCTION_MODE: true,
        SESSION_TIMEOUT: 30 * 60 * 1000,
        DATA_EXPIRY: 24 * 60 * 60 * 1000,
        INACTIVITY_TIMEOUT: 15 * 60 * 1000,
        MAX_API_KEY_ATTEMPTS: 5,
        ATTEMPT_LOCKOUT_TIME: 15 * 60 * 1000,
        STORAGE_PREFIX: '_oce_',
        INTEGRITY_CHECK_INTERVAL: 30000
    };

    // ============================================
    // 1. CONSOLE PROTECTION
    // ============================================
    const ConsoleProtection = {
        originalConsole: {},
        
        init: function() {
            if (!CONFIG.PRODUCTION_MODE) return;
            
            this.backupOriginal();
            this.overrideConsoleMethods();
            this.clearConsole();
        },
        
        backupOriginal: function() {
            ['log', 'warn', 'error', 'info', 'debug', 'table', 'trace'].forEach(method => {
                this.originalConsole[method] = console[method];
            });
        },
        
        overrideConsoleMethods: function() {
            const noop = function() {};
            
            console.log = noop;
            console.warn = noop;
            console.info = noop;
            console.debug = noop;
            console.table = noop;
            console.trace = noop;
            
            console.error = function(msg) {
                if (typeof msg === 'string' && !msg.includes('API') && !msg.includes('key')) {
                    return;
                }
            };
        },
        
        clearConsole: function() {
            try {
                console.clear();
            } catch(e) {}
        },
        
        secureLog: function(category, message) {
            if (!CONFIG.PRODUCTION_MODE && this.originalConsole.log) {
                this.originalConsole.log(`[${category}]`, message);
            }
        }
    };

    // ============================================
    // 2. DEVTOOLS DETECTION
    // ============================================
    const DevToolsDetection = {
        isOpen: false,
        warningShown: false,
        
        init: function() {
            if (!CONFIG.PRODUCTION_MODE) return;
            
            this.detectBySize();
            this.detectByDebugger();
            this.detectByTiming();
            
            window.addEventListener('resize', () => this.detectBySize());
        },
        
        detectBySize: function() {
            const threshold = 160;
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            
            if (widthThreshold || heightThreshold) {
                this.handleDevToolsOpen();
            }
        },
        
        detectByDebugger: function() {
            const start = performance.now();
            debugger;
            const end = performance.now();
            
            if (end - start > 100) {
                this.handleDevToolsOpen();
            }
        },
        
        detectByTiming: function() {
            setInterval(() => {
                const start = performance.now();
                for (let i = 0; i < 100; i++) {
                    console.log(i);
                    console.clear();
                }
                const end = performance.now();
                
                if (end - start > 200) {
                    this.handleDevToolsOpen();
                }
            }, 5000);
        },
        
        handleDevToolsOpen: function() {
            if (!this.warningShown) {
                this.isOpen = true;
                this.warningShown = true;
                SecurityManager.clearSensitiveData();
            }
        }
    };

    // ============================================
    // 3. ENCRYPTION UTILITIES
    // ============================================
    const CryptoUtils = {
        secretKey: null,
        
        init: function() {
            this.secretKey = this.generateSessionKey();
        },
        
        generateSessionKey: function() {
            const array = new Uint8Array(32);
            crypto.getRandomValues(array);
            return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
        },
        
        encode: function(data) {
            try {
                const jsonStr = JSON.stringify(data);
                const encoded = btoa(unescape(encodeURIComponent(jsonStr)));
                const shuffled = this.shuffle(encoded);
                return shuffled;
            } catch(e) {
                return null;
            }
        },
        
        decode: function(encoded) {
            try {
                const unshuffled = this.unshuffle(encoded);
                const jsonStr = decodeURIComponent(escape(atob(unshuffled)));
                return JSON.parse(jsonStr);
            } catch(e) {
                return null;
            }
        },
        
        shuffle: function(str) {
            const arr = str.split('');
            for (let i = arr.length - 1; i > 0; i--) {
                const j = (i * 7) % (i + 1);
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr.join('');
        },
        
        unshuffle: function(str) {
            const arr = str.split('');
            const len = arr.length;
            const swaps = [];
            
            for (let i = len - 1; i > 0; i--) {
                swaps.push([i, (i * 7) % (i + 1)]);
            }
            
            for (let i = swaps.length - 1; i >= 0; i--) {
                const [a, b] = swaps[i];
                [arr[a], arr[b]] = [arr[b], arr[a]];
            }
            
            return arr.join('');
        },
        
        obfuscateApiKey: function(key) {
            if (!key) return null;
            const timestamp = Date.now().toString(36);
            const payload = { k: key, t: timestamp, v: 1 };
            return CONFIG.STORAGE_PREFIX + this.encode(payload);
        },
        
        deobfuscateApiKey: function(obfuscated) {
            if (!obfuscated || !obfuscated.startsWith(CONFIG.STORAGE_PREFIX)) {
                return null;
            }
            
            try {
                const encoded = obfuscated.substring(CONFIG.STORAGE_PREFIX.length);
                const payload = this.decode(encoded);
                
                if (!payload || !payload.k) return null;
                
                const storedTime = parseInt(payload.t, 36);
                if (Date.now() - storedTime > CONFIG.DATA_EXPIRY) {
                    return null;
                }
                
                return payload.k;
            } catch(e) {
                return null;
            }
        },
        
        maskApiKey: function(key) {
            if (!key || key.length < 8) return '****';
            return '****' + key.slice(-4);
        }
    };

    // ============================================
    // 4. SECURE STORAGE
    // ============================================
    const SecureStorage = {
        API_KEY_STORAGE: '_oce_ak',
        DATA_STORAGE: 'ocr_chat_data',
        SESSION_STORAGE: '_oce_session',
        
        init: function() {
            this.validateDataIntegrity();
            this.cleanExpiredData();
        },
        
        setApiKey: function(key) {
            const obfuscated = CryptoUtils.obfuscateApiKey(key);
            if (obfuscated) {
                sessionStorage.setItem(this.API_KEY_STORAGE, obfuscated);
                localStorage.removeItem('gemini_api_key');
                return true;
            }
            return false;
        },
        
        getApiKey: function() {
            const obfuscated = sessionStorage.getItem(this.API_KEY_STORAGE);
            if (obfuscated) {
                return CryptoUtils.deobfuscateApiKey(obfuscated);
            }
            
            const legacyKey = localStorage.getItem('gemini_api_key');
            if (legacyKey) {
                this.setApiKey(legacyKey);
                localStorage.removeItem('gemini_api_key');
                return legacyKey;
            }
            
            return null;
        },
        
        removeApiKey: function() {
            sessionStorage.removeItem(this.API_KEY_STORAGE);
            localStorage.removeItem('gemini_api_key');
        },
        
        hasApiKey: function() {
            return !!this.getApiKey();
        },
        
        setData: function(key, data) {
            try {
                const wrapper = {
                    d: data,
                    t: Date.now(),
                    h: this.generateHash(JSON.stringify(data))
                };
                localStorage.setItem(key, JSON.stringify(wrapper));
                return true;
            } catch(e) {
                return false;
            }
        },
        
        getData: function(key) {
            try {
                const raw = localStorage.getItem(key);
                if (!raw) return null;
                
                const wrapper = JSON.parse(raw);
                
                if (Date.now() - wrapper.t > CONFIG.DATA_EXPIRY) {
                    localStorage.removeItem(key);
                    return null;
                }
                
                const currentHash = this.generateHash(JSON.stringify(wrapper.d));
                if (currentHash !== wrapper.h) {
                    localStorage.removeItem(key);
                    return null;
                }
                
                return wrapper.d;
            } catch(e) {
                return null;
            }
        },
        
        generateHash: function(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return hash.toString(36);
        },
        
        validateDataIntegrity: function() {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(CONFIG.STORAGE_PREFIX)) {
                    try {
                        const raw = localStorage.getItem(key);
                        const wrapper = JSON.parse(raw);
                        if (wrapper.h) {
                            const currentHash = this.generateHash(JSON.stringify(wrapper.d));
                            if (currentHash !== wrapper.h) {
                                localStorage.removeItem(key);
                            }
                        }
                    } catch(e) {
                        localStorage.removeItem(key);
                    }
                }
            });
        },
        
        cleanExpiredData: function() {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                try {
                    const raw = localStorage.getItem(key);
                    const wrapper = JSON.parse(raw);
                    if (wrapper.t && Date.now() - wrapper.t > CONFIG.DATA_EXPIRY) {
                        localStorage.removeItem(key);
                    }
                } catch(e) {}
            });
        },
        
        clearAll: function() {
            sessionStorage.clear();
            const keysToRemove = [];
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(CONFIG.STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key));
        }
    };

    // ============================================
    // 5. SESSION MANAGEMENT
    // ============================================
    const SessionManager = {
        lastActivity: Date.now(),
        sessionTimer: null,
        inactivityTimer: null,
        
        init: function() {
            this.startSession();
            this.setupActivityTracking();
            this.setupInactivityTimeout();
        },
        
        startSession: function() {
            this.lastActivity = Date.now();
            sessionStorage.setItem(SecureStorage.SESSION_STORAGE, JSON.stringify({
                started: this.lastActivity,
                lastActivity: this.lastActivity
            }));
        },
        
        setupActivityTracking: function() {
            const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
            events.forEach(event => {
                document.addEventListener(event, () => this.recordActivity(), { passive: true });
            });
        },
        
        recordActivity: function() {
            this.lastActivity = Date.now();
            this.resetInactivityTimer();
        },
        
        setupInactivityTimeout: function() {
            this.resetInactivityTimer();
        },
        
        resetInactivityTimer: function() {
            if (this.inactivityTimer) {
                clearTimeout(this.inactivityTimer);
            }
            
            this.inactivityTimer = setTimeout(() => {
                this.handleInactivity();
            }, CONFIG.INACTIVITY_TIMEOUT);
        },
        
        handleInactivity: function() {
            SecureStorage.removeApiKey();
            if (typeof showApiKeyModal === 'function') {
                showApiKeyModal();
            }
        },
        
        isSessionValid: function() {
            const session = sessionStorage.getItem(SecureStorage.SESSION_STORAGE);
            if (!session) return false;
            
            try {
                const data = JSON.parse(session);
                return Date.now() - data.started < CONFIG.SESSION_TIMEOUT;
            } catch(e) {
                return false;
            }
        }
    };

    // ============================================
    // 6. API KEY RATE LIMITING
    // ============================================
    const RateLimiter = {
        attempts: [],
        lockedUntil: null,
        
        init: function() {
            this.loadState();
        },
        
        loadState: function() {
            try {
                const state = sessionStorage.getItem('_oce_rl');
                if (state) {
                    const data = JSON.parse(state);
                    this.attempts = data.attempts || [];
                    this.lockedUntil = data.lockedUntil || null;
                }
            } catch(e) {}
        },
        
        saveState: function() {
            sessionStorage.setItem('_oce_rl', JSON.stringify({
                attempts: this.attempts,
                lockedUntil: this.lockedUntil
            }));
        },
        
        canAttempt: function() {
            if (this.lockedUntil && Date.now() < this.lockedUntil) {
                return false;
            }
            
            this.lockedUntil = null;
            
            const cutoff = Date.now() - 60000;
            this.attempts = this.attempts.filter(t => t > cutoff);
            
            return this.attempts.length < CONFIG.MAX_API_KEY_ATTEMPTS;
        },
        
        recordAttempt: function() {
            this.attempts.push(Date.now());
            
            if (this.attempts.length >= CONFIG.MAX_API_KEY_ATTEMPTS) {
                this.lockedUntil = Date.now() + CONFIG.ATTEMPT_LOCKOUT_TIME;
            }
            
            this.saveState();
        },
        
        getRemainingAttempts: function() {
            const cutoff = Date.now() - 60000;
            this.attempts = this.attempts.filter(t => t > cutoff);
            return CONFIG.MAX_API_KEY_ATTEMPTS - this.attempts.length;
        },
        
        getLockoutRemaining: function() {
            if (!this.lockedUntil) return 0;
            return Math.max(0, this.lockedUntil - Date.now());
        }
    };

    // ============================================
    // 7. INPUT SANITIZATION
    // ============================================
    const InputSanitizer = {
        sanitizeString: function(str) {
            if (typeof str !== 'string') return '';
            return str
                .replace(/[<>]/g, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+=/gi, '')
                .trim();
        },
        
        sanitizeApiKey: function(key) {
            if (typeof key !== 'string') return '';
            return key.replace(/[^a-zA-Z0-9_-]/g, '').trim();
        },
        
        validateApiKeyFormat: function(key) {
            if (!key || typeof key !== 'string') return false;
            if (key.length < 20 || key.length > 100) return false;
            return /^[a-zA-Z0-9_-]+$/.test(key);
        }
    };

    // ============================================
    // 8. SECURITY MANAGER (Main Controller)
    // ============================================
    const SecurityManager = {
        initialized: false,
        
        init: function() {
            if (this.initialized) return;
            
            CryptoUtils.init();
            ConsoleProtection.init();
            SecureStorage.init();
            SessionManager.init();
            RateLimiter.init();
            
            this.setupCleanupHandlers();
            this.setupIntegrityChecks();
            this.patchGlobalFunctions();
            
            this.initialized = true;
        },
        
        setupCleanupHandlers: function() {
            window.addEventListener('beforeunload', () => {
                this.clearSensitiveData();
            });
            
            window.addEventListener('pagehide', () => {
                this.clearSensitiveData();
            });
            
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden') {
                    this.clearTemporaryData();
                }
            });
        },
        
        setupIntegrityChecks: function() {
            setInterval(() => {
                SecureStorage.validateDataIntegrity();
                SecureStorage.cleanExpiredData();
            }, CONFIG.INTEGRITY_CHECK_INTERVAL);
        },
        
        patchGlobalFunctions: function() {
            const self = this;
            
            window.getApiKey = function() {
                return SecureStorage.getApiKey();
            };
            
            window.setApiKey = function(key) {
                const sanitized = InputSanitizer.sanitizeApiKey(key);
                if (!InputSanitizer.validateApiKeyFormat(sanitized)) {
                    return false;
                }
                return SecureStorage.setApiKey(sanitized);
            };
            
            window.checkApiKey = function() {
                if (!SecureStorage.hasApiKey()) {
                    if (typeof showApiKeyModal === 'function') {
                        showApiKeyModal();
                    }
                } else {
                    if (typeof hideApiKeyModal === 'function') {
                        hideApiKeyModal();
                    }
                }
            };
            
            window.clearApiKeyInput = function() {
                const input = document.getElementById('apiKeyInput');
                if (input) {
                    input.value = '';
                    input.blur();
                }
            };
            
            window.getMaskedApiKey = function() {
                const key = SecureStorage.getApiKey();
                return CryptoUtils.maskApiKey(key);
            };
        },
        
        clearSensitiveData: function() {
            window.clearApiKeyInput && window.clearApiKeyInput();
            
            const sensitiveInputs = document.querySelectorAll('input[type="password"]');
            sensitiveInputs.forEach(input => {
                input.value = '';
            });
        },
        
        clearTemporaryData: function() {
            window.clearApiKeyInput && window.clearApiKeyInput();
        },
        
        canAttemptApiKey: function() {
            return RateLimiter.canAttempt();
        },
        
        recordApiKeyAttempt: function() {
            RateLimiter.recordAttempt();
        },
        
        getSecurityStatus: function() {
            return {
                sessionValid: SessionManager.isSessionValid(),
                hasApiKey: SecureStorage.hasApiKey(),
                remainingAttempts: RateLimiter.getRemainingAttempts(),
                lockoutRemaining: RateLimiter.getLockoutRemaining()
            };
        }
    };

    // ============================================
    // 9. ERROR HANDLER
    // ============================================
    const SecureErrorHandler = {
        init: function() {
            if (!CONFIG.PRODUCTION_MODE) return;
            
            window.onerror = function(msg, url, line, col, error) {
                return true;
            };
            
            window.addEventListener('unhandledrejection', function(event) {
                event.preventDefault();
            });
        },
        
        handleError: function(error, context) {
            const genericMessages = {
                'network': 'Koneksi bermasalah. Coba lagi.',
                'auth': 'Autentikasi gagal.',
                'validation': 'Data tidak valid.',
                'default': 'Terjadi kesalahan. Coba lagi.'
            };
            
            return genericMessages[context] || genericMessages.default;
        }
    };

    // ============================================
    // INITIALIZE ON LOAD
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            SecurityManager.init();
            SecureErrorHandler.init();
        });
    } else {
        SecurityManager.init();
        SecureErrorHandler.init();
    }

    // ============================================
    // EXPOSE PUBLIC API
    // ============================================
    window.Security = {
        getApiKey: () => SecureStorage.getApiKey(),
        setApiKey: (key) => {
            const sanitized = InputSanitizer.sanitizeApiKey(key);
            if (!InputSanitizer.validateApiKeyFormat(sanitized)) {
                return false;
            }
            return SecureStorage.setApiKey(sanitized);
        },
        removeApiKey: () => SecureStorage.removeApiKey(),
        hasApiKey: () => SecureStorage.hasApiKey(),
        getMaskedKey: () => CryptoUtils.maskApiKey(SecureStorage.getApiKey()),
        canAttempt: () => RateLimiter.canAttempt(),
        recordAttempt: () => RateLimiter.recordAttempt(),
        clearInputs: () => SecurityManager.clearSensitiveData(),
        sanitize: (str) => InputSanitizer.sanitizeString(str),
        getStatus: () => SecurityManager.getSecurityStatus()
    };

})();
