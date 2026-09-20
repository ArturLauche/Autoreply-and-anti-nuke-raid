---
name: token-economy
description: Use before reading files, running commands, or writing responses in any session where context budget matters — especially long sessions, large files (>500 lines), repetitive verification runs, or when summarizing tool output. Enforces search-first reading, windowed file access, batched tool calls, and output filtering so the agent spends tokens on decisions instead of raw dumps.
---

# Token Economy

## Overview

Context is a budget. Every full-file read, repeated test run, and echoed tool
output spends it. Wasted context does not just cost money — it degrades
attention: important instructions and diffs get pushed out by noise. The rule:
**locate first, read windows, filter output, summarize once.**

## Reading code

1. **Search before reading.** Use code search (grep/ripgrep) with a specific
   pattern + line numbers to find the region of interest. Only then read.
2. **Read windows, not files.** For any file over ~400 lines, read with
   `offset`/`limit` around the target (200–400 lines is usually enough).
   Never read a generated file (`convex/_generated/`) or a lockfile.
3. **Batch independent reads.** Multiple paths in ONE read call, not several
   sequential turns. Same for independent searches and commands.
4. **Track what you already know.** Never re-read content already in context
   this session. If unsure a file changed, check `git diff` scope first, not
   the whole file.
5. **One memory probe beats three reads.** Before hunting for where something
   lives, check repo docs (AGENTS.md, docs/) which usually name the file.

## Running commands

1. **Filter output at the source.** Pipe through `| tail -N` / `| head -N` /
   `| grep -E "pattern"` instead of dumping thousands of lines, e.g.
   `bun run test 2>&1 | tail -3`.
2. **Combine verification into one command** with clear separators:
   `cmd1; echo ===; cmd2` — one tool call, one output block.
3. **Never run the same check twice without changing anything in between.**
   If a check just passed and no file changed, the result stands.
4. **Scoped diffs.** `git diff -- <path>` for the files in question; never
   paste whole-repo diffs into context.
5. **Timeouts tight.** Prefer 30s defaults; long sleeps waste wall-clock and
   encourage re-polling loops. Poll at most once per expected duration.

## Writing responses and summaries

1. **Summarize tool output once**, with line numbers as evidence
   (`src/x.ts:42`), instead of quoting it back.
2. **Tables over prose** when comparing items; bullets over paragraphs
   otherwise. No restating the user's question back at them.
3. **Fail fast on missing info.** One targeted question instead of exploring
   speculatively — exploration costs far more than asking.
4. **Progress notes short.** What was done + numbers + next step. The next
   agent (or a resumed session) reads these instead of re-deriving history.

## Hard limits

- Do not read `.env*`, `bot/.bot-key`, `*.pem`, `*.key` (secret rule — also
  pure waste: their content must never enter context).
- Do not cat a file to "see what's inside" when a search of its symbols
  answers the question.
- If a response would exceed ~40 lines of code blocks, prefer attaching the
  change via file edits rather than printing it in chat.
