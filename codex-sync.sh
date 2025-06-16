#!/bin/bash
set -e

git add .

if git diff --cached --quiet; then
  echo "✅ Nothing to commit."
  exit 0
fi

read -p "💬 Enter commit message: " commit_msg

git commit -m "$commit_msg"
git push origin main

echo "🚀 Changes committed and pushed successfully!"
