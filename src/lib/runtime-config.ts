const productionEnv = process.env.NODE_ENV === "production";

export function isProductionRuntime() {
  return productionEnv;
}

export function isDemoReadFallbackEnabled() {
  return !productionEnv || process.env.ALLOW_DEMO_FALLBACK === "true";
}

export function getMissingProductionEnv() {
  if (!productionEnv) return [];

  return [
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_BASE_URL",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "SESSION_SECRET"
  ].filter((key) => !process.env[key]);
}
