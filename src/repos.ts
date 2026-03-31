import { resolve } from "node:path";

export const REPOS =
  process.env["XDG_DATA_HOME"]
    ? resolve(process.env["XDG_DATA_HOME"], "repos")
    : resolve(process.env["HOME"] ?? "/", ".local/share/repos");
