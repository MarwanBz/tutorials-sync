#!/bin/bash
# Ralph Wiggum - Human-in-the-Loop single iteration
# Usage: ./ralph-once.sh
#
# This version runs ONE iteration at a time, allowing you to review
# progress and steer the AI between tasks. Useful for complex features
# that need human guidance.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PRD_FILE="$SCRIPT_DIR/prd.json"
PROGRESS_FILE="$SCRIPT_DIR/progress.txt"

# Initialize progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Ralph Progress Log" > "$PROGRESS_FILE"
  echo "Started: $(date)" >> "$PROGRESS_FILE"
  echo "---" >> "$PROGRESS_FILE"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Ralph - Single Iteration (Human in the Loop)"
echo "═══════════════════════════════════════════════════════"
echo ""

# Show current PRD status
if [ -f "$PRD_FILE" ]; then
  echo "Current PRD Status:"
  echo "  Project: $(jq -r '.project // "Unknown"' "$PRD_FILE")"
  echo "  Branch: $(jq -r '.branchName // "main"' "$PRD_FILE")"
  echo "  Stories: $(jq '[.userStories[] | select(.passes == false)] | length' "$PRD_FILE") pending, $(jq '[.userStories[] | select(.passes == true)] | length' "$PRD_FILE") completed"
  echo ""
fi

# Run Claude Code with the ralph prompt (non-interactive mode)
claude --permission-mode acceptEdits -p "$(cat "$SCRIPT_DIR/prompt.md")"

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Iteration Complete"
echo "═══════════════════════════════════════════════════════"
echo ""
echo "Review the changes above, then run ./ralph-once.sh again for the next task."
