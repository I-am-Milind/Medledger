type RememberedRole = 'patient' | 'doctor';

export type RememberedAuthInfo = {
  email: string;
  role: RememberedRole;
  displayName?: string;
  phone?: string;
  hospitalId?: string;
};

const authCookieName = 'medledger_auth_hint';
const authCookieMaxAgeSeconds = 60 * 60 * 24 * 30;

function normalizeRememberedAuthInfo(raw: unknown): RememberedAuthInfo | null {
  const item = raw as Partial<RememberedAuthInfo>;
  if (!item || typeof item.email !== 'string' || typeof item.role !== 'string') {
    return null;
  }

  if (item.role !== 'patient' && item.role !== 'doctor') {
    return null;
  }

  return {
    email: item.email,
    role: item.role,
    displayName: typeof item.displayName === 'string' ? item.displayName : undefined,
    phone: typeof item.phone === 'string' ? item.phone : undefined,
    hospitalId: typeof item.hospitalId === 'string' ? item.hospitalId : undefined,
  };
}

export function readRememberedAuthInfo(): RememberedAuthInfo | null {
  if (typeof document === 'undefined') {
    return null;
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${authCookieName}=`));

  if (!cookie) {
    return null;
  }

  const encoded = cookie.slice(authCookieName.length + 1);
  if (!encoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(encoded)) as unknown;
    return normalizeRememberedAuthInfo(parsed);
  } catch {
    return null;
  }
}

export function writeRememberedAuthInfo(payload: RememberedAuthInfo): void {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; Secure' : '';
  const serialized = encodeURIComponent(JSON.stringify(payload));
  document.cookie =
    `${authCookieName}=${serialized}; Max-Age=${authCookieMaxAgeSeconds}; Path=/; SameSite=Lax${secure}`;
}
