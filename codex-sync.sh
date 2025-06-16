#!/bin/bash
set -e

# Load token from external, git-ignored file
if [ -f .codex-secrets.sh ]; then
  source .codex-secrets.sh
else
  echo "❌ Missing .codex-secrets.sh with GIT_REMOTE_URL"
  exit 1
fi

# Add remote if missing
if ! git remote | grep -q origin; then
  echo "🔗 Setting up Git remote..."
  git remote add origin "$GIT_REMOTE_URL"
  git fetch origin
  git branch --set-upstream-to=origin/main main || true
fi

# Stage changes
git add .

# If nothing staged, exit
if git diff --cached --quiet; then
  echo "✅ Nothing to commit."
  exit 0
fi

# Ask for commit message
read -p "💬 Enter commit message: " commit_msg
git commit -m "$commit_msg"
git push origin main

echo "🚀 Changes committed and pushed successfully!"
