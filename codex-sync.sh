#!/bin/bash

set -e

git add .
git diff --cached --quiet && echo "✅ Nothing to commit." && exit 0

commit_msg="Codex auto-commit: $(date +'%Y-%m-%d %H:%M:%S')"
git commit -m "$commit_msg"
git push origin main

echo "🚀 Changes committed and pushed successfully!"
