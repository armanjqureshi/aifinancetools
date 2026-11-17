/**
 * Runtime configuration. Everything is read from environment variables so the
 * same build runs on a laptop (LOCAL_MODE=true) or on a team server.
 *
 * LOCAL_MODE=true is a shorthand for AUTH_MODE=none + STORAGE_DRIVER=local.
 * Either setting can still be overridden individually.
 */
const localMode = process.env.LOCAL_MODE === "true";

type AuthMode = "none" | "password";
type StorageDriver = "local" | "s3";

function readAuthMode(): AuthMode {
  const value = (process.env.AUTH_MODE ?? "").trim().toLowerCase();
  if (value === "none" || value === "password") return value;
  return localMode ? "none" : "password";
}

function readStorageDriver(): StorageDriver {
  const value = (process.env.STORAGE_DRIVER ?? "").trim().toLowerCase();
  if (value === "local" || value === "s3") return value;
  return "local";
}

export const ENV = {
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  isProduction: process.env.NODE_ENV === "production",
  localMode,
  /** "none": single local administrator, no sign-in. "password": email + password accounts. */
  authMode: readAuthMode(),
  /** Optional first administrator, created at start-up when AUTH_MODE=password. */
  adminEmail: process.env.ADMIN_EMAIL ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  /** "local": PDFs on disk under LOCAL_STORAGE_DIR. "s3": any S3-compatible bucket. */
  storageDriver: readStorageDriver(),
  localAppOrigin: process.env.LOCAL_APP_ORIGIN ?? "http://localhost:3000",
  s3Bucket: process.env.S3_BUCKET ?? "",
  s3Region: process.env.S3_REGION ?? "ap-south-1",
  s3Endpoint: process.env.S3_ENDPOINT ?? "",
  s3AccessKeyId: process.env.S3_ACCESS_KEY_ID ?? "",
  s3SecretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "",
  s3ForcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
  /** AI is opt-in: it needs LLM_API_URL, LLM_API_KEY and LLM_DEFAULT_MODEL. */
  aiEnabled: process.env.DISABLE_AI !== "true",
  llmApiUrl: process.env.LLM_API_URL ?? "",
  llmApiKey: process.env.LLM_API_KEY ?? "",
  llmDefaultModel: process.env.LLM_DEFAULT_MODEL ?? "",
};
