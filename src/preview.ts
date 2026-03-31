import { existsSync, readFileSync, lstatSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { REPOS } from "./repos.ts";

function run(cmd: string, args: string[], cwd?: string): string {
  try {
    return execFileSync(cmd, args, {
      cwd,
      encoding: "utf-8",
      timeout: 5000,
      env: { ...process.env, NO_COLOR: undefined },
    }).trimEnd();
  } catch {
    return "";
  }
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function parseLine(line: string): string {
  const clean = stripAnsi(line);
  const rest = clean.slice(clean.indexOf(" ") + 1); // skip mark
  let p = rest.slice(rest.indexOf(" ") + 1); // skip timestamp
  p = p.replace(/ -> .*$/, ""); // strip symlink arrow
  return p;
}

function previewJj(r: string): void {
  // jj workspace info
  const jjRepoFile = join(r, ".jj", "repo");
  try {
    const st = lstatSync(jjRepoFile);
    if (st.isFile()) {
      const parent = readFileSync(jjRepoFile, "utf-8").trim();
      console.log(`jj workspace of: ${parent.replace(/\/.jj\/repo$/, "")}`);
    }
  } catch {}

  // Related bookmarks
  const bookmarkOutput = run("jj", ["-R", r, "log", "-r", "@ | trunk()", "--no-graph",
    "-T", 'if(bookmarks, bookmarks ++ "\\n")', "--no-pager"]);
  if (bookmarkOutput) {
    const bookmarks = [...new Set(bookmarkOutput.split("\n").filter(Boolean))].sort();
    if (bookmarks.length > 0) {
      console.log("--- bookmarks ---");
      for (const bm of bookmarks) {
        const detail = run("jj", ["-R", r, "bookmark", "list", "--all", bm, "--color=always", "--no-pager"]);
        if (detail) console.log(detail);
      }
    }
  }

  // jj log: trunk()::@
  console.log("--- jj ---");

  const refsRaw = run("jj", ["-R", r, "log", "-r", "trunk()::@", "--no-graph", "--color=never", "--no-pager",
    "-T", 'change_id.shortest(4) ++ "|" ++ local_bookmarks ++ "|" ++ remote_bookmarks.join(",") ++ "|" ++ tags.join(",") ++ "|" ++ if(git_head, "HEAD", "") ++ "\\n"']);

  const refsMap = new Map<string, string>();
  if (refsRaw) {
    for (const line of refsRaw.split("\n").filter(Boolean)) {
      const [changeId, local, remote, tags, head] = line.split("|");
      const parts: string[] = [];
      if (local) parts.push(`\x1b[35m${local}\x1b[0m`);
      if (remote) {
        for (const rb of remote.split(",").filter(Boolean)) {
          const atIdx = rb.indexOf("@");
          if (atIdx >= 0) {
            parts.push(`\x1b[4;35m${rb.slice(0, atIdx)}\x1b[0m\x1b[4;2;35m${rb.slice(atIdx)}\x1b[0m`);
          } else {
            parts.push(`\x1b[4;35m${rb}\x1b[0m`);
          }
        }
      }
      if (tags) parts.push(`\x1b[31m${tags}\x1b[0m`);
      if (head) parts.push(`\x1b[1;3;31m${head}\x1b[0m`);
      if (changeId) refsMap.set(changeId, parts.join(", "));
    }
  }

  const logOutput = run("jj", ["-R", r, "log", "-r", "trunk()::@", "--no-graph", "--color=always", "--no-pager",
    "-T", 'concat(committer.timestamp().format("%Y-%m-%dT%H:%M:%S%z"), if(current_working_copy, " @", "  "), " ", change_id.shortest(4), " ", commit_id.shortest(7), if(description, " " ++ description.first_line()), " (", author.name(), ")\\n")']);

  if (logOutput) {
    const lines = logOutput.split("\n").filter(Boolean);
    let count = 0;
    for (const line of lines) {
      if (count >= 8) break;
      // Extract change_id from the line (after @ or spaces, 4+ chars)
      const cleanLine = stripAnsi(line);
      const match = cleanLine.match(/[@ ] ([a-z]{4,}) /);
      const changeId = match?.[1];
      const refs = changeId ? refsMap.get(changeId) : undefined;
      if (refs) {
        console.log(`${line} (${refs})`);
      } else {
        console.log(line);
      }
      count++;
    }
  }
}

function previewGit(r: string): void {
  const gitPath = join(r, ".git");

  // git worktree info
  try {
    const st = lstatSync(gitPath);
    if (st.isFile()) {
      const content = readFileSync(gitPath, "utf-8").trim();
      const gitDir = content.replace(/^gitdir: /, "");
      const parent = gitDir.replace(/\/.git\/worktrees\/.*$/, "");
      console.log(`git worktree of: ${parent}`);
    }
  } catch {}

  const branch = run("git", ["-C", r, "branch", "--show-current"]);
  const statusRaw = run("git", ["-C", r, "status", "--short"]);
  let statusSummary = "(clean)";
  if (statusRaw) {
    const counts = new Map<string, number>();
    for (const line of statusRaw.split("\n").filter(Boolean)) {
      const code = line.slice(0, 2);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    statusSummary = [...counts.entries()].map(([k, v]) => `${k.trim()}:${v}`).join(" ");
  }
  const wtCount = run("git", ["-C", r, "worktree", "list"])
    .split("\n").filter(Boolean).length;

  console.log(`Branch: ${branch}  ${statusSummary}  Worktrees: ${wtCount}`);
  console.log("--- git log ---");
  const log = run("git", ["-C", r, "tr", "--color=always", "-5"]);
  if (log) console.log(log);
}

export async function cmdPreview(rawLine: string): Promise<void> {
  const p = parseLine(rawLine);
  const r = join(REPOS, p);

  if (existsSync(join(r, ".jj"))) {
    previewJj(r);
  }
  if (existsSync(join(r, ".git"))) {
    previewGit(r);
  }
}
