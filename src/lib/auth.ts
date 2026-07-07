import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { isProductionRuntime } from "@/lib/runtime-config";

const cookieName = "huowu_admin_session";
const maxAgeSeconds = 60 * 60 * 12;

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

export async function createAdminSession() {
  const issuedAt = Date.now();
  const payload = `admin.${issuedAt}`;
  const signature = sign(payload);
  if (!signature) {
    throw new Error("SESSION_SECRET is required in production.");
  }

  const token = `${payload}.${signature}`;
  const cookieStore = await cookies();

  cookieStore.set(cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds
  });
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete(cookieName);
}

export async function isAdminAuthenticated() {
  const cookieStore = await cookies();
  const token = cookieStore.get(cookieName)?.value;

  if (!token) return false;

  const [scope, issuedAt, signature] = token.split(".");
  if (scope !== "admin" || !issuedAt || !signature) return false;

  const issuedAtNumber = Number(issuedAt);
  if (!Number.isFinite(issuedAtNumber)) return false;
  if (Date.now() - issuedAtNumber > maxAgeSeconds * 1000) return false;

  const expectedSignature = sign(`${scope}.${issuedAt}`);
  if (!expectedSignature) return false;

  return safeEqual(expectedSignature, signature);
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
