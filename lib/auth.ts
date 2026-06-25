import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";

export const AUTH_COOKIE = "vsctruck_session";
export const AUTH_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionPayload = {
  u: string;
  r: "admin" | "manager" | "viewer";
  exp: number;
};

export function getAuthCredentials() {
  const username = process.env.VSC_AUTH_USERNAME ?? (process.env.NODE_ENV === "production" ? "" : "admin");
  const password =
    process.env.VSC_AUTH_PASSWORD ?? (process.env.NODE_ENV === "production" ? "" : "VscTruck@2026");

  return { username, password };
}

export function getAuthSecret() {
  const secret = process.env.VSC_AUTH_SECRET;
  if (!secret && process.env.NODE_ENV === "production") {
    throw new Error("Missing VSC_AUTH_SECRET in environment");
  }
  return secret ?? "dev-vsctruck-secret";
}

export function isAuthConfigured() {
  const credentials = getAuthCredentials();
  return Boolean(credentials.username && credentials.password && getAuthSecret());
}

export function validateCredentials(username: string, password: string) {
  const credentials = getAuthCredentials();
  if (!credentials.username || !credentials.password) {
    return false;
  }

  return safeEqual(username, credentials.username) && safeEqual(password, credentials.password);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("base64url");
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("base64url");
  return `pbkdf2_sha256$120000$${salt}$${hash}`;
}

export function verifyPassword(password: string, storedHash: string) {
  const [algorithm, iterations, salt, hash] = storedHash.split("$");
  if (algorithm !== "pbkdf2_sha256" || !iterations || !salt || !hash) {
    return false;
  }

  const candidate = pbkdf2Sync(password, salt, Number(iterations), 32, "sha256").toString("base64url");
  return safeEqual(candidate, hash);
}

export function createSessionToken(username: string, role: SessionPayload["r"] = "viewer") {
  const payload: SessionPayload = {
    u: username,
    r: role,
    exp: Math.floor(Date.now() / 1000) + AUTH_MAX_AGE_SECONDS,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function getSessionFromCookieHeader(cookieHeader: string | null) {
  const cookie = parseCookie(cookieHeader ?? "")[AUTH_COOKIE];
  if (!cookie) {
    return null;
  }

  const [payload, signature] = cookie.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    return null;
  }

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<SessionPayload>;
    if (!session.u || !session.exp || session.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return {
      username: session.u,
      role: session.r ?? "viewer",
      exp: session.exp,
    };
  } catch {
    return null;
  }
}

function parseCookie(value: string) {
  return Object.fromEntries(
    value
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index === -1 ? [part, ""] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function sign(value: string) {
  return createHmac("sha256", getAuthSecret()).update(value).digest("base64url");
}

function base64UrlEncode(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}
