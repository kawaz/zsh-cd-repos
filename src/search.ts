import { execFileSync } from "node:child_process";
import { REPOS } from "./repos.ts";
import { cmdList } from "./list.ts";

export async function cmdSearch(query: string): Promise<void> {
  // Pipe cmd_list output to fzf
  const self = process.argv[1] ?? "cd-repos";

  // Generate list first, then feed to fzf
  // We capture stdout from cmdList by temporarily replacing process.stdout.write
  let listOutput = "";
  const origWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array) => {
    listOutput += typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
    return true;
  }) as typeof process.stdout.write;
  await cmdList();
  process.stdout.write = origWrite;

  if (!listOutput.trim()) return;

  let selected: string;
  try {
    selected = execFileSync("fzf", [
      "--exact", "--no-mouse", "--select-1", "--exit-0", "--ansi", "--no-sort",
      "--query", query,
      "--preview", `${self} preview {}`,
      "--preview-window", "up,70%,wrap",
      "--bind", "ctrl-/:toggle-preview",
    ], {
      input: listOutput,
      encoding: "utf-8",
      timeout: 0,
      stdio: ["pipe", "pipe", "inherit"],
    }).trimEnd();
  } catch {
    return; // fzf cancelled or error
  }

  if (!selected) return;

  // Parse: skip mark, skip timestamp, take path, strip symlink arrow
  const rest = selected.slice(selected.indexOf(" ") + 1); // skip mark
  let p = rest.slice(rest.indexOf(" ") + 1); // skip timestamp
  p = p.replace(/ -> .*$/, ""); // strip symlink arrow
  // Strip ANSI codes
  p = p.replace(/\x1b\[[0-9;]*m/g, "");

  if (p) {
    console.log(`${REPOS}/${p}`);
  }
}
