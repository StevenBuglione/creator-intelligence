import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { AppError } from "../../domain/src/index.js";
export const randomToken = () => randomBytes(32).toString("base64url");
export const digest = (s: string) =>
  createHash("sha256").update(s).digest("hex");
export function equal(a: string, b: string) {
  return timingSafeEqual(
    createHash("sha256").update(a).digest(),
    createHash("sha256").update(b).digest(),
  );
}
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, value] = hash.split(":");
  return (
    !!salt &&
    !!value &&
    equal(scryptSync(password, salt, 64).toString("hex"), value)
  );
}
export function seal(value: unknown, key: string, aad: string) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", Buffer.from(key, "base64"), iv);
  cipher.setAAD(Buffer.from(aad));
  const data = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), data]
    .map((x) => x.toString("base64url"))
    .join(".");
}
export function unseal<T>(value: string, key: string, aad: string): T {
  try {
    const [iv, tag, data] = value
      .split(".")
      .map((x) => Buffer.from(x, "base64url"));
    if (!iv || !tag || !data) throw new Error();
    const cipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(key, "base64"),
      iv,
    );
    cipher.setAAD(Buffer.from(aad));
    cipher.setAuthTag(tag);
    return JSON.parse(
      Buffer.concat([cipher.update(data), cipher.final()]).toString("utf8"),
    ) as T;
  } catch {
    throw new AppError("CREDENTIAL_DECRYPTION_FAILED", 503);
  }
}
export function pkce() {
  const verifier = randomToken();
  return {
    verifier,
    challenge: createHash("sha256").update(verifier).digest("base64url"),
  };
}
