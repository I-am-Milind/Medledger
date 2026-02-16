const STATIC_ADMIN_EMAIL = 'admin@med.com';
const STATIC_ADMIN_PASSWORD = 'admin@123';
const ADMIN_SESSION_STORAGE_KEY = 'medledger.static-admin-session';

export type StaticAdminSession = {
  email: string;
  token: string;
  expiresAt: string;
  loggedInAt: string;
};

export function isValidStaticAdminCredentials(email: string, password: string): boolean {
  return email.trim().toLowerCase() === STATIC_ADMIN_EMAIL && password === STATIC_ADMIN_PASSWORD;
}

export function getStaticAdminSession(): StaticAdminSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(ADMIN_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StaticAdminSession>;
    if (
      typeof parsed.email !== 'string' ||
      typeof parsed.token !== 'string' ||
      typeof parsed.expiresAt !== 'string' ||
      typeof parsed.loggedInAt !== 'string'
    ) {
      return null;
    }

    const expiresMs = Date.parse(parsed.expiresAt);
    if (Number.isNaN(expiresMs) || expiresMs <= Date.now()) {
      clearStaticAdminSession();
      return null;
    }

    return {
      email: parsed.email,
      token: parsed.token,
      expiresAt: parsed.expiresAt,
      loggedInAt: parsed.loggedInAt,
    };
  } catch {
    return null;
  }
}

export function createStaticAdminSession(payload: {
  email: string;
  token: string;
  expiresAt: string;
}): void {
  if (typeof window === 'undefined') {
    return;
  }

  const sessionPayload: StaticAdminSession = {
    email: payload.email.trim().toLowerCase(),
    token: payload.token,
    expiresAt: payload.expiresAt,
    loggedInAt: new Date().toISOString(),
  };
  window.localStorage.setItem(ADMIN_SESSION_STORAGE_KEY, JSON.stringify(sessionPayload));
}

export function clearStaticAdminSession(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(ADMIN_SESSION_STORAGE_KEY);
}

export const staticAdminHint = {
  email: STATIC_ADMIN_EMAIL,
  password: STATIC_ADMIN_PASSWORD,
};
