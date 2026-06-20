---
name: git-guardrails
description: Git safety rules for PrecisionQuote. Blocks destructive operations to prevent accidental data loss.
---

# Git Guardrails — PrecisionQuote

## Blocked Commands

The following git commands are **forbidden** without explicit user confirmation:

| Pattern | Risk |
|---------|------|
| `git push` (all variants) | Must be done manually by user |
| `git push --force` / `git push -f` | Rewrites remote history |
| `git reset --hard` | Discards all local changes |
| `git clean -f` / `git clean -fd` | Deletes untracked files permanently |
| `git branch -D` | Force-deletes branch |
| `git checkout .` / `git restore .` | Discards all working tree changes |
| `git stash drop` | Loses stashed changes |
| `git tag -d` | Deletes local tags |

## Safe Alternatives

| Instead of | Use |
|------------|-----|
| `git push` | Tell user to push manually |
| `git reset --hard` | `git stash` or `git checkout -- <file>` |
| `git clean -f` | `git status` first, then ask user |
| `git branch -D` | `git branch -d` (safe delete) |
| `git checkout .` | `git diff` first, then selective restore |

## Verification Checklist

Before any git operation, verify:

1. `git status` — no uncommitted changes that would be lost
2. `git diff --stat` — understand what changes exist
3. `git log --oneline -5` — confirm current branch/commits
4. Never operate on `main` or `master` without explicit instruction

## Setup for OpenCode

Add to `AGENTS.md`:

```
## Git Guardrails

**DO NOT** execute these commands without explicit user confirmation:
- git push (any variant)
- git reset --hard
- git clean -f / -fd
- git branch -D
- git checkout . / git restore .

Always run `git status` before destructive operations.
```
