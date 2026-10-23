import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const root = dirname(dirname(fileURLToPath(import.meta.url)));
const local =
  process.platform === "win32"
    ? join(root, ".venv", "Scripts", "python.exe")
    : join(root, ".venv", "bin", "python");
const python = process.env.PYTHON || (existsSync(local) ? local : "python");
const commands = process.argv.includes("--import")
  ? [["scripts/import_excel.py"]]
  : [["scripts/manage_data.py", "validate"]];
commands.push(["scripts/export_data.py"]);
for (const args of commands) {
  const r = spawnSync(python, args, { cwd: root, stdio: "inherit" });
  if (r.error) {
    console.error(
      "No se pudo ejecutar Python. Instala requirements.txt y consulta README.md.",
    );
    process.exit(1);
  }
  if (r.status !== 0) process.exit(r.status || 1);
}
