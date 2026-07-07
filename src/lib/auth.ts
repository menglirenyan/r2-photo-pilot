import { createHmac, pbkdf2Sync, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { isProductionRuntime } from "@/lib/runtime-config";

const cookieName = "huowu_admin_session";
const maxAgeSeconds = 60 * 60 * 12;
const passwordIterations = 210000;

export type AuthSession =
  | {
      role: "admin";
      issuedAt: number;
    }
  | {
      role: "company";
      companySlug: string;
      issuedAt: number;
    };

function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!isProductionRuntime()) return "local-development-session-secret";

  return null;
}

function sign(value: string) {
  const secret = getSessionSecret();
  if (!secret) return null;

  return createHmac("sha256", secret).update(value).digest("hex");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function createToken(scope: "admin" | "company", target: string) {
  const issuedAt = Date.now();
  const payload = `${scope}.${target}.${issuedAt}`;
  const signature = sign(payload);
  if (!signature) {
    throw new Error("SESSION_SECRET is required in production.");
  }

  return `${payload}.${signature}`;
}

async function setSessionCookie(token: string) {
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds
  });
}

export async function createAdminSession() {
  await setSessionCookie(createToken("admin", "platform"));
}

export async function createCompanySession(companySlug: string) {
  await setSessionCookie(createToken("company", companySlug));
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) return null;

  const parts = token.split(".");
  const [scope, target, issuedAt, signature] =
    parts.length === 4 ? parts : parts.length === 3 ? [parts[0], "platform", parts[1], parts[2]] : [];

  if ((scope !== "admin" && scope !== "company") || !target || !issuedAt || !signature) return null;

  const issuedAtNumber = Number(issuedAt);
  if (!Number.isFinite(issuedAtNumber)) return null;
  if (Date.now() - issuedAtNumber > maxAgeSeconds * 1000) return null;

  const expectedSignature = sign(`${scope}.${target}.${issuedAt}`);
  const legacyExpectedSignature = scope === "admin" ? sign(`${scope}.${issuedAt}`) : null;
  if (!expectedSignature) return null;

  const valid =
    safeEqual(expectedSignature, signature) ||
    Boolean(legacyExpectedSignature && safeEqual(legacyExpectedSignature, signature));

  if (!valid) return null;
  if (scope === "admin") return { role: "admin", issuedAt: issuedAtNumber };

  return { role: "company", companySlug: target, issuedAt: issuedAtNumber };
}

export async function isAdminAuthenticated() {
  return (await getAuthSession())?.role === "admin";
}

export async function isCompanyAuthenticated(companySlug: string) {
  const session = await getAuthSession();
  return session?.role === "company" && session.companySlug === companySlug;
}

export async function isCompanyOrAdminAuthenticated(companySlug: string) {
  const session = await getAuthSession();
  return session?.role === "admin" || (session?.role === "company" && session.companySlug === companySlug);
}

function getAdminUsername() {
  if (process.env.ADMIN_USERNAME) return process.env.ADMIN_USERNAME;
  if (!isProductionRuntime()) return "admin";

  return null;
}

function getAdminPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!isProductionRuntime()) return "admin123";

  return null;
}

export function isAdminCredentialsValid(username: string, password: string) {
  const expectedUsername = getAdminUsername();
  const expectedPassword = getAdminPassword();

  if (!expectedUsername || !expectedPassword) return false;

  return safeEqual(username, expectedUsername) && safeEqual(password, expectedPassword);
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, passwordIterations, 32, "sha256").toString("hex");
  return `pbkdf2$${passwordIterations}$${salt}$${hash}`;
}

export function isPasswordHashValid(password: string, storedHash: string) {
  const [scheme, iterations, salt, expectedHash] = storedHash.split("$");
  const parsedIterations = Number(iterations);

  if (scheme !== "pbkdf2" || !Number.isFinite(parsedIterations) || !salt || !expectedHash) {
    return false;
  }

  const hash = pbkdf2Sync(password, salt, parsedIterations, 32, "sha256").toString("hex");
  return safeEqual(hash, expectedHash);
}
