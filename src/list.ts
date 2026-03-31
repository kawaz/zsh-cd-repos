import { readdirSync, statSync, lstatSync, readlinkSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { REPOS } from "./repos.ts";

interface RepoEntry {
  /** relative path from REPOS (e.g. "github.com/kawaz/zsh-cd-repos/main") */
  path: string;
  /** mtime of the directory */
  mtime: Date;
  /** first 3 path components (host/org/repo) */
  repoBase: string;
  /** true if this is the repo root (3-component path) */
  isParent: boolean;
  /** Git mark: B=bare, G=normal, W=worktree, -=none */
  gitMark: string;
  /** jj mark: J=repo, W=workspace, -=none */
  jjMark: string;
  /** true if symlink */
  isSymlink: boolean;
  /** symlink target (only if isSymlink) */
  linkTarget?: string;
}

function formatTimestamp(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** ANSI color helpers */
const c = {
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  magenta: (s: string) => `\x1b[35m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  gray: (s: string) => `\x1b[90m${s}\x1b[0m`,
};

function detectGitMark(dir: string): string {
  const gitPath = join(dir, ".git");
  try {
    const st = lstatSync(gitPath);
    if (st.isDirectory()) {
      // check bare
      try {
        const config = readFileSync(join(gitPath, "config"), "utf-8");
        if (config.includes("bare = true")) return "B";
      } catch {}
      return "G";
    }
    if (st.isFile()) return "W"; // worktree link
  } catch {}
  return "-";
}

function detectJjMark(dir: string): string {
  const jjRepo = join(dir, ".jj", "repo");
  try {
    const st = lstatSync(jjRepo);
    if (st.isDirectory()) return "J"; // jj repo entity
    return "W"; // jj workspace (file link)
  } catch {}
  return "-";
}

function colorGitMark(m: string): string {
  switch (m) {
    case "B": return c.blue("B");
    case "G": return c.blue("G");
    case "W": return c.magenta("W");
    default:  return c.gray("-");
  }
}

function colorJjMark(m: string): string {
  switch (m) {
    case "J": return c.green("J");
    case "W": return c.yellow("W");
    default:  return c.gray("-");
  }
}

function discoverRepos(): RepoEntry[] {
  const entries: RepoEntry[] = [];

  // Walk: REPOS / host / org / repo [/ workspace]
  let hosts: string[];
  try {
    hosts = readdirSync(REPOS);
  } catch {
    return entries;
  }

  for (const host of hosts) {
    const hostDir = join(REPOS, host);
    let orgs: string[];
    try { orgs = readdirSync(hostDir); } catch { continue; }

    for (const org of orgs) {
      const orgDir = join(hostDir, org);
      let repos: string[];
      try { repos = readdirSync(orgDir); } catch { continue; }

      for (const repo of repos) {
        const repoDir = join(orgDir, repo);
        const relPath = `${host}/${org}/${repo}`;

        // Check if this 3-level dir is a repo itself
        const gitMark3 = detectGitMark(repoDir);
        const jjMark3 = detectJjMark(repoDir);
        if (gitMark3 !== "-" || jjMark3 !== "-") {
          const ls = lstatSync(repoDir);
          entries.push({
            path: relPath,
            mtime: ls.mtime,
            repoBase: relPath,
            isParent: true,
            gitMark: gitMark3,
            jjMark: jjMark3,
            isSymlink: ls.isSymbolicLink(),
            linkTarget: ls.isSymbolicLink() ? readlinkSync(repoDir) : undefined,
          });
        }

        // Check 4-level children (workspaces/worktrees)
        let children: string[];
        try { children = readdirSync(repoDir); } catch { continue; }

        for (const child of children) {
          const childDir = join(repoDir, child);
          const childRel = `${relPath}/${child}`;
          const gitMarkC = detectGitMark(childDir);
          const jjMarkC = detectJjMark(childDir);
          if (gitMarkC === "-" && jjMarkC === "-") continue;

          const ls = lstatSync(childDir);
          entries.push({
            path: childRel,
            mtime: ls.mtime,
            repoBase: relPath,
            isParent: false,
            gitMark: gitMarkC,
            jjMark: jjMarkC,
            isSymlink: ls.isSymbolicLink(),
            linkTarget: ls.isSymbolicLink() ? readlinkSync(childDir) : undefined,
          });
        }
      }
    }
  }

  return entries;
}

export function listEntries(): RepoEntry[] {
  const entries = discoverRepos();

  // Compute max mtime per repoBase group
  const groupMaxMtime = new Map<string, number>();
  for (const e of entries) {
    const cur = groupMaxMtime.get(e.repoBase) ?? 0;
    const t = e.mtime.getTime();
    if (t > cur) groupMaxMtime.set(e.repoBase, t);
  }

  // Sort: group max mtime desc, repoBase asc, isParent asc (children first), mtime desc
  entries.sort((a, b) => {
    const ga = groupMaxMtime.get(a.repoBase) ?? 0;
    const gb = groupMaxMtime.get(b.repoBase) ?? 0;
    if (ga !== gb) return gb - ga; // desc
    if (a.repoBase !== b.repoBase) return a.repoBase < b.repoBase ? -1 : 1;
    if (a.isParent !== b.isParent) return a.isParent ? 1 : -1; // children first
    return b.mtime.getTime() - a.mtime.getTime(); // desc
  });

  return entries;
}

export function formatEntry(e: RepoEntry): string {
  const ts = formatTimestamp(e.mtime);
  const gm = colorGitMark(e.gitMark);
  const jm = colorJjMark(e.jjMark);
  const pathColor = e.isSymlink ? c.cyan : c.blue;
  const link = e.linkTarget ? ` -> ${e.linkTarget}` : "";
  return `${gm}${jm} ${ts} ${pathColor(e.path + link)}`;
}

export async function cmdList(): Promise<void> {
  const entries = listEntries();
  const lines = entries.map(formatEntry);
  const out = lines.join("\n") + "\n";
  process.stdout.write(out);
}
