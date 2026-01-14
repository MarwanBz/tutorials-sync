# Git Aliases Mastery

> Master your git aliases - faster workflow, less typing, and never forget what gpl or gpf actually does.

---
Type: post
Date: 2025-12-28
Reading time: 11 min read
Tags: Git, Aliases, Zsh, CLI, Workflow
---

# Git Aliases Mastery

You have 44+ git aliases in your zsh config. But admit it - you only use a handful and forget the rest. You know `gpl` is pull, but what's `gmt`? What's `gundo`?

This tutorial will teach you all your aliases by category, with memorable patterns so you actually use them.

**Goal:** Type less, do more, never lookup `git` commands again.

## Why Aliases Matter

Without aliases:
```bash
git add .
git commit -m "fix bug"
git push origin main
git status
git log --oneline --graph --decorate
```

With your aliases:
```bash
gaa
gc "fix bug"
gpo main
gs
gl
```

**60% less typing.** Multiply that by 100 git commands a day = hours saved per week.

## The Mental Model: Categories, Not Random

Your aliases follow patterns. Once you see the patterns, they become unforgettable:

| Prefix | Meaning | Examples |
|--------|---------|----------|
| `g` | General git commands | `g`, `gs`, `ga`, `gc` |
| `gp` | Git push | `gp`, `gpo`, `gpf` |
| `gpl` | Git pull | `gpl`, `gplo` |
| `gb` | Git branch | `gb`, `gbd`, `gbd!` |
| `gm` | Git merge | `gm`, `gmt` |
| `gl` | Git log | `gl`, `gll`, `glg` |
| `gst` | Git stash | `gst`, `gstp`, `gstl`, `gsta` |
| `gr` | Git remote/reset | `gr`, `gru`, `grs`, `grsh` |
| `gd` | Git diff | `gd`, `gds`, `gdw` |

**Pattern:** First letters = operation, suffix = variation.

---

## Category 1: The Essentials (Use Daily)

You'll use these every single day. Memorize them first.

### Basic Workflow

```bash
g     # git
gs    # git status
ga    # git add
gaa   # git add --all (add ALL files)
gc    # git commit -m
gco   # git checkout
```

**Mental trick:**
- `gs` = **g**it **s**tatus
- `ga` = **g**it **a**dd
- `gaa` = **g**it **a**dd **a**ll (double a = all)
- `gc` = **g**it **c**ommit
- `gco` = **g**it **c**heck**o**ut

**Example workflow:**
```bash
# Create a new feature branch
gcb feature/login

# Make changes, then see what changed
gs

# Add all changes
gaa

# Commit with message
gc "add login page"

# Push to origin
gp
```

---

## Category 2: Push & Pull Operations

```bash
gp    # git push
gpo   # git push origin
gpl   # git pull
gplo  # git pull origin
gpf   # git push --force-with-lease
```

**Mental trick:**
- `gp` = **g**it **p**ush
- `gpl` = **g**it **p**u**l**l (the `l` = pull)
- `o` suffix = **o**rigin

**When to use what:**

| Command | When to use |
|---------|-------------|
| `gp` | Push to default remote (configured upstream) |
| `gpo` | Push to origin specifically |
| `gpl` | Pull from default remote |
| `gplo` | Pull from origin specifically |
| `gpf` | Force push (safer) - only when you know what you're doing! |

**⚠️ Warning:** `gpf` uses `--force-with-lease` (safer than `--force`). It prevents overwriting others' work if the remote has commits you don't have.

---

## Category 3: Branch Management

```bash
gb     # git branch
gbd    # git branch -d (delete merged branch)
gbd!   # git branch -D (delete branch even if unmerged)
gm     # git merge
gmt    # git merge --no-ff
gcb    # git checkout -b (create new branch)
```

**Mental trick:**
- `gb` = **g**it **b**ranch
- `d` suffix = **d**elete
- `!` = force (delete even if unmerged)
- `gm` = **g**it **m**erge
- `t` suffix = **t**hread/ff (no fast-forward)

**Example workflows:**

```bash
# List all branches
gb

# Create and switch to new branch
gcb feature/user-auth

# Work done, merge to main
gm main

# Delete merged feature branch
gbd feature/user-auth

# Force delete unmerged branch (emergency only!)
gbd! broken-branch
```

**What is `--no-ff`?** (`gmt`)

Fast-forward merge:
```
A --- B --- C  (main)
         \
          D  (feature)
```
After `git merge feature`: A → B → C → D (feature branch name disappears)

No-fast-forward merge:
```
A --- B --- C -------- E  (main)
         \           /
          D  --------  (feature)
```
After `git merge --no-ff feature`: A → B → C → E (E is a merge commit, preserves feature branch history)

**Use `gmt` when you want to keep feature branch history visible.**

---

## Category 4: Log & History Visualization

```bash
gl    # git log --oneline --graph --decorate
gll   # git log --oneline --graph --decorate --all
glg   # git log --graph --pretty=format:'...' --abbrev-commit
```

**Mental trick:**
- `gl` = **g**it **l**og
- Extra `l` = **all** branches
- `g` = **g**raph (detailed format)

**What each shows:**

`gl` - Pretty graph of current branch:
```
* a1b2c3d (HEAD -> main) Fix login bug
* d4e5f6g (origin/main) Add user profile
* g7h8i9j Initial commit
```

`gll` - Same, but ALL branches:
```
* a1b2c3d (HEAD -> feature) Add feature
* d4e5f6g (main) Fix bug
| * x1y2z3w (staging) Staging changes
|/
* g7h8i9j Initial commit
```

`glg` - Detailed with author, date, colors:
```
* a1b2c3d - (HEAD -> main) Fix login bug (2 hours ago) <Marwan>
* d4e5f6g - Add user profile (1 day ago) <Marwan>
```

**When to use:**
- `gl` - Quick history check (use most often)
- `gll` - See all branches and their relationships
- `glg` - Detailed view with who/when

---

## Category 5: Stash Management

```bash
gst    # git stash
gstp   # git stash pop
gstl   # git stash list
gsta   # git stash apply
```

**Mental trick:**
- `gst` = **g**it **s**ta**t**sh (or **st**ash)
- `p` = **p**op (restore and remove)
- `l` = **l**ist
- `a` = **a**pply (restore but keep in stash list)

**What is stash?** Temporary storage for uncommitted changes.

**Workflow example:**

```bash
# Working on feature, but need to fix urgent bug
gs  # Check status

# Save current work temporarily
gst

# Switch to main and fix bug
gco main
gc "fix urgent bug"
gp

# Go back to feature and restore work
gco feature
gstp  # Pop stash back
```

**Stash pop vs apply:**
- `gstp` - Restores AND removes from stash list
- `gsta` - Restores BUT keeps in stash list (use if you might need it again)

---

## Category 6: Diff & Show Changes

```bash
gd     # git diff
gds    # git diff --staged
gdw    # git diff --word-diff
gsh    # git show
```

**Mental trick:**
- `gd` = **g**it **d**iff
- `s` = **s**taged (changes about to be committed)
- `w` = **w**ord diff (see word-level changes)
- `sh` = **sh**ow (display commit)

**When to use:**

```bash
# See what you changed but haven't staged
gd

# See what's staged (about to be committed)
gds

# See exact word changes (great for documentation)
gdw README.md

# Show what a commit changed
gsh a1b2c3d  # Show commit a1b2c3d
```

**Word diff example (`gdw`):**
```diff
{-previous text-} +{new text}
```
Shows exactly which words changed, highlighted.

---

## Category 7: Reset & Clean (Destructive!)

```bash
grs    # git reset
grsh   # git reset --hard (DANGER!)
gcl    # git clean -fd (DANGER!)
```

**Mental trick:**
- `grs` = **g**it **r**e**s**et
- `h` = **h**ard (force, can't undo!)
- `gcl` = **g**it **c**lean

**⚠️ DANGER ZONE - Use with caution!**

| Command | What it does | Danger level |
|---------|--------------|--------------|
| `grs` | Unstage files | 🟡 Safe (just unstages) |
| `grsh` | Reset to commit, discard ALL changes | 🔴 VERY DANGEROUS |
| `gcl` | Delete untracked files/directories | 🔴 DANGEROUS |

**When to use:**

```bash
# Oops, staged wrong file - unstage it
grs HEAD~ file.txt

# 💀 ABORT MISSION - Undo everything since last commit
grsh HEAD

# Clean up untracked files (build artifacts, etc.)
gcl  # Deletes untracked files and directories
```

**Before using `grsh`:** Make sure you have backup or really mean it!

---

## Category 8: Cherry-pick & Rebase

```bash
gcp    # git cherry-pick
grb    # git rebase
grbc   # git rebase --continue
grba   # git rebase --abort
```

**Mental trick:**
- `gcp` = **g**it **c**herry-**p**ick
- `grb` = **g**it **r**e**b**ase
- `c` = **c**ontinue
- `a` = **a**bort

**Cherry-pick:** Apply a specific commit from another branch.

```bash
# Want commit x1y2z3w from feature branch
gcp x1y2z3w

# Want multiple commits
gcp a1b2c3d^..d4e5f6g  # Apply range of commits
```

**Rebase:** Move your branch to start from another point.

```bash
# Rebase current branch onto main
grb main

# During rebase, if conflicts occur:
# Fix conflicts, then:
grbc  # Continue rebase

# Or give up:
grba  # Abort and go back to before rebase
```

**When to use rebase:**
- Keep linear history (no merge commits)
- Apply your changes on top of updated main
- Squash multiple commits into one

---

## Category 9: Remote Management

```bash
gr     # git remote
gru    # git remote update
grv    # git remote -v
```

**Mental trick:**
- `gr` = **g**it **r**emote
- `u` = **u**pdate
- `v` = **v**erbose

**Usage:**

```bash
# List remotes
gr

# List remotes with URLs
grv

# Update all remotes (fetch from origin, etc.)
gru
```

---

## Category 10: Utility Commands (Hidden Gems)

```bash
gignore     # git update-index --assume-unchanged
gunignore   # git update-index --no-assume-unchanged
gwho        # git shortlog -s -n (contributors by commit count)
gcount      # git shortlog -sn --all
ginit       # git init + empty initial commit
gundo       # git reset --soft HEAD~1 (undo last commit, keep changes)
gredo       # git commit -c ORIG_HEAD (restore undone commit)
```

**The hidden gems:**

**`gignore`** - Stop tracking file locally (don't commit to .gitignore)

```bash
# Have a config file with local settings?
gignore config.local  # Stop tracking it

# Changed your mind?
gunignore config.local  # Track it again
```

**`gwho`** - Who contributed most?

```bash
gwho
# Output:
# 125  Marwan
#  42  Ahmed
#  15  Sara
```

**`ginit`** - Quick repo setup

```bash
mkdir new-project
cd new-project
ginit  # Creates repo + initial commit in one command!
```

**`gundo` & `gredo`** - Undo mistakes

```bash
# Committed too early, forgot to add file
gundo  # Undo commit, keep changes staged

# Add forgotten file
ga forgotten-file.txt

# Redo commit with all changes
gredo  # Restores the commit message
```

---

## Quick Reference Card

Print this and keep it handy:

```
DAILY USE:
  gs        gaa        gc         gco        gp
  status    add all    commit    checkout  push

BRANCHES:
  gb        gbd        gcb        gm         mmt
  branch    delete    new branch merge    no-ff merge

PUSH/PULL:
  gpl       gplo       gp         gpo        gpf
  pull      pull org   push       push org  force push

HISTORY:
  gl        gll        glg
  log       log all    detailed log

STASH:
  gst       gstp       gstl       gsta
  stash     pop        list       apply

DIFF:
  gd        gds        gdw        gsh
  diff      staged     word-diff  show commit

RESET (DANGER):
  grs       grsh       gcl
  reset     hard reset clean

REBASE:
  grb       grbc       grba       gcp
  rebase    continue   abort      cherry-pick

UTILITY:
  gwho      gcount     ginit      gundo      gredo
  contributors commits   quick-init undo last  redo
```

---

## Try It Yourself

**Exercise: Create a Cheat Sheet**

1. Create a file `~/git-aliases-cheat.txt`
2. Organize by categories (copy from Quick Reference above)
3. Add YOUR own examples from your actual workflow
4. Keep it open in a split terminal for reference

**Exercise: Daily Usage Challenge**

For one week, force yourself to use ONLY aliases:
- Type `gs` instead of `git status`
- Type `gaa` instead of `git add .`
- Type `gc` instead of `git commit -m`

By day 3, you'll be faster. By day 7, muscle memory kicks in.

---

## Summary

**The patterns you now know:**
- Single letter = operation (`b` = branch, `l` = log, `s` = status)
- Double letter = variation (`aa` = all, `ll` = all branches)
- Suffix letters = modifiers (`o` = origin, `h` = hard, `t` = thread)

**The 10 aliases you'll use 80% of the time:**
1. `gs` - status
2. `gaa` - add all
3. `gc` - commit
4. `gp` - push
5. `gpl` - pull
6. `gco` - checkout
7. `gb` - branch
8. `gl` - log
9. `gd` - diff
10. `gst` - stash

Master these first, then gradually adopt others as needed.

**You're now typing 60% less.** Welcome to the fast lane.

---

## Q&A

[Questions and answers will be added here as you ask them during the tutorial]

## Quiz History

[Quiz sessions will be recorded here after you are quizzed on this topic]