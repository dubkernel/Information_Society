#!/bin/bash
# journal.sh - Enhanced script to create a journal entry for today's coding session

# Get the current date in YYYY-MM-DD format
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H:%M)

# Create a journal entry file with the current date
JOURNAL_FILE=".dev/journals/journal_$DATE.md"

# Check if we're in a git repository
if git rev-parse --git-dir > /dev/null 2>&1; then
    # Get recent commits from today
    RECENT_COMMITS=$(git log --since="today 00:00" --oneline 2>/dev/null)
    
    # Get uncommitted changes
    UNCOMMITTED_CHANGES=$(git status --porcelain 2>/dev/null)
else
    RECENT_COMMITS=""
    UNCOMMITTED_CHANGES=""
fi

# Create the journal entry with auto-populated information
cat > "$JOURNAL_FILE" << EOF
# Coding Session Journal
Date: $DATE
Time: $TIME
Duration: {duration}
Author: {author}

## Today's Work
- What did you work on today?

## Changes Made
- Files modified:
$(if [ -n "$UNCOMMITTED_CHANGES" ]; then
    echo "  - Uncommitted changes:"
    echo "$UNCOMMITTED_CHANGES" | sed 's/^/    - /'
  fi)
$(if [ -n "$RECENT_COMMITS" ]; then
    echo "  - Recent commits:"
    echo "$RECENT_COMMITS" | sed 's/^/    - /'
  fi)

- Features added/removed:
  - {brief description of changes}

## Reasoning
{description of why changes were made}

## Next Steps
- {what comes next}

## Learnings
- {key learnings from today}
EOF

echo "Created journal entry: .dev/journals/journal_$DATE.md"
echo "Please edit this file to document today's coding session."