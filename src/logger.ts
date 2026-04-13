import * as fs from "fs";
import * as path from "path";

const LOG_DIR = path.join(process.cwd(), ".logs");
const LOG_FILE = path.join(LOG_DIR, "think-inc.log");

let writeStream: fs.WriteStream | null = null;
let initialized = false;

function ensureInitialized(): boolean {
  if (initialized) return true;

  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    writeStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
    initialized = true;
    return true;
  } catch {
    return false;
  }
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

export function log(...args: unknown[]) {
  if (!ensureInitialized() || !writeStream) return;

  const timestamp = formatTimestamp();
  const message = args
    .map(a => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)))
    .join(" ");
  writeStream.write(`[${timestamp}] ${message}\n`);
}

export function flush(): Promise<void> {
  if (!writeStream) return Promise.resolve();
  
  return new Promise((resolve) => {
    writeStream!.end(() => {
      writeStream = null;
      initialized = false;
      resolve();
    });
  });
}

export function clearLog() {
  if (!ensureInitialized()) return;
  writeStream?.close();
  fs.writeFileSync(LOG_FILE, "");
  writeStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
}
