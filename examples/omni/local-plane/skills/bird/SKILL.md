---
name: bird
description: X/Twitter CLI for reading, searching, posting, and engagement via cookies.
homepage: https://bird.fast
metadata:
  {
    "omni":
      {
        "emoji": "🐦",
        "requires": { "bins": ["bird"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "steipete/tap/bird",
              "bins": ["bird"],
              "label": "Install bird (brew)",
            },
            {
              "id": "npm",
              "kind": "node",
              "package": "@steipete/bird",
              "bins": ["bird"],
              "label": "Install bird (npm)",
            },
          ],
      },
  }
---

# bird 🐦

Fast X/Twitter CLI using GraphQL + cookie auth.

## Install

```bash
# npm/pnpm/bun
npm install -g @steipete/bird

# Homebrew (macOS, prebuilt binary)
brew install steipete/tap/bird

# One-shot (no install)
bunx @steipete/bird whoami
```

## Authentication

`bird` uses cookie-based auth.

Use `--auth-token` / `--ct0` to pass cookies directly, or `--cookie-source` for browser cookies.

Run `bird check` to see which source is active. For Arc/Brave, use `--chrome-profile-dir <path>`.

## Commands

### Account & Auth

```bash
bird whoami                    # Show logged-in account
bird check                     # Show credential sources
bird query-ids --fresh         # Refresh GraphQL query ID cache
```

### Reading Tweets

```bash
bird read <url-or-id>          # Read a single tweet
bird <url-or-id>               # Shorthand for read
bird thread <url-or-id>        # Full conversation thread
bird replies <url-or-id>       # List replies to a tweet
```

### Timelines

```bash
bird home                      # Home timeline (For You)
bird home --following          # Following timeline
bird user-tweets @handle -n 20 # User's profile timeline
bird mentions                  # Tweets mentioning you
bird mentions --user @handle   # Mentions of another user
```

### Search

```bash
bird search "query" -n 10
bird search "from:steipete" --all --max-pages 3
```

### News & Trending

```bash
bird news -n 10                # AI-curated from Explore tabs
bird news --ai-only            # Filter to AI-curated only
bird news --sports             # Sports tab
bird news --with-tweets        # Include related tweets
bird trending                  # Alias for news
```

### Lists

```bash
bird lists                     # Your lists
bird lists --member-of         # Lists you're a member of
bird list-timeline <id> -n 20  # Tweets from a list
```

### Bookmarks & Likes

```bash
bird bookmarks -n 10
bird bookmarks --folder-id <id>           # Specific folder
bird unbookmark <url-or-id>
bird likes -n 10
```

### Social Graph

```bash
bird following -n 20           # Users you follow
bird followers -n 20           # Users following you
bird about @handle             # Account origin/location info
```

### Engagement Actions

```bash
bird follow @handle            # Follow a user
bird unfollow @handle          # Unfollow a user
```

### Posting

```bash
bird tweet "hello world"
bird reply <url-or-id> "nice thread!"
bird tweet "check this out" --media image.png --alt "description"
```

**⚠️ Posting risks**: Posting is more likely to be rate limited; if blocked, use the browser tool instead.

## Output Options

```bash
--json          # JSON output
--plain         # No emoji, no color (script-friendly)
--no-emoji      # Disable emoji
--no-color      # Disable ANSI colors
```

## Config File

`~/.config/bird/config.json5` (global) or `./.birdrc.json5` (project):

```json5
{
  cookieSource: ["chrome"],
  chromeProfileDir: "/path/to/Arc/Profile",
  timeoutMs: 20000,
}
```

## Troubleshooting

### Query IDs stale (404 errors)

```bash
bird query-ids --fresh
```

### Cookie extraction fails

- Check browser is logged into X
- Try different `--cookie-source`
- For Arc/Brave: use `--chrome-profile-dir`

---

**TL;DR**: Read/search/engage with CLI. Post carefully or use browser. 🐦
