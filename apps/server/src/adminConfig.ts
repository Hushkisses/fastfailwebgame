import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export interface AdminConfigFile {
  trigger: string;
  password: string;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const defaultConfig: AdminConfigFile = {
  trigger: "__FG_ADMIN_TRIGGER__",
  password: "changeme"
};

function tryRead(p: string): AdminConfigFile | null {
  try {
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== "object") return null;
    const trigger = (data as { trigger?: unknown }).trigger;
    const password = (data as { password?: unknown }).password;
    if (typeof trigger !== "string" || typeof password !== "string") return null;
    return { trigger, password };
  } catch {
    return null;
  }
}

/**
 * `config/admin-config.json` (저장소 루트) 또는 `ADMIN_CONFIG_PATH`.
 * 파일이 없으면 내장 기본값(개발용)을 사용합니다.
 */
export function loadAdminConfig(): AdminConfigFile {
  const envPath = process.env.ADMIN_CONFIG_PATH;
  const candidates = [
    typeof envPath === "string" && envPath.length > 0 ? path.resolve(envPath) : null,
    path.resolve(process.cwd(), "config", "admin-config.json"),
    path.join(__dirname, "../../../config/admin-config.json"),
    path.join(__dirname, "../../../config/admin-config.example.json")
  ].filter((p): p is string => Boolean(p));

  for (const p of candidates) {
    if (!fs.existsSync(p)) continue;
    const parsed = tryRead(p);
    if (!parsed) continue;
    const trigger = parsed.trigger.trim();
    if (!trigger || !parsed.password.length) {
      console.warn(`[admin] invalid admin config at ${p}, using defaults`);
      return { ...defaultConfig };
    }
    return { trigger, password: parsed.password };
  }

  console.warn("[admin] no admin-config.json found; using built-in defaults (change for production)");
  return { ...defaultConfig };
}
