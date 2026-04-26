# 🏏 XO-Arena — Hand Cricket Discord Bot

A full-featured, arcade-style Hand Cricket game bot for Discord. Supports PvP, AI modes with difficulty levels, live scorecards, sledging, coin rewards, stats, and a leaderboard.

---

## 📁 Project Structure

```
xo-arena/
├── index.js                  # Bot entry point & interaction router
├── deploy-commands.js        # Register slash commands with Discord
├── .env.example              # Environment config template
│
├── commands/
│   ├── handcricket.js        # /handcricket pvp | ai
│   ├── leaderboard.js        # /leaderboard
│   ├── stats.js              # /stats
│   └── rematch.js            # /rematch (redirect hint)
│
├── games/
│   ├── handcricket.js        # Core game state machine
│   └── ai-handcricket.js     # AI engine (Easy / Medium / Hard)
│
├── sessions/
│   └── gameManager.js        # Session orchestrator & interaction dispatcher
│
├── utils/
│   ├── database.js           # SQLite stats & coins persistence
│   ├── ui.js                 # All Discord embed & component builders
│   └── flavor.js             # Sledges, GIFs, crowd reactions, emojis
│
└── data/
    └── xo-arena.db           # Auto-created SQLite database
```

---

## 🚀 Setup & Installation

### 1. Prerequisites
- **Node.js v18+**
- A Discord Application & Bot Token → [Discord Developer Portal](https://discord.com/developers/applications)

### 2. Clone & Install

```bash
git clone <your-repo>
cd xo-arena
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id
GUILD_ID=your_test_server_id    # remove for global deployment
```

### 4. Deploy Slash Commands

```bash
node deploy-commands.js
```

> First run or after adding new commands. Guild deployment is instant; global takes ~1 hour.

### 5. Start the Bot

```bash
npm start
# or for development with auto-restart:
npm run dev
```

---

## 🎮 How to Play

### Starting a Game

| Command | Description |
|---------|-------------|
| `/handcricket ai` | Play vs AI bot (pick difficulty) |
| `/handcricket pvp @user` | Challenge another player |

### Game Flow

```
1. Start game → Difficulty (AI) / Toss prompt
2. Toss → Odd/Even call → Winner chooses Bat or Bowl
3. Innings 1 → Both players pick numbers (1–6) via buttons
   • Same number = OUT 💀
   • Different = Batter scores that many runs
4. Innings 2 → Chase the target
5. Result → Coins awarded, stats saved, Rematch button
```

### Scoring
- **WIN** → +20 coins
- **LOSS** → +5 coins (participation)

---

## 🤖 AI Difficulty Levels

| Level  | Behavior |
|--------|----------|
| 😴 Easy   | Pure random — unpredictable but beatable |
| 😐 Medium | Pattern-aware — slightly avoids your favourites |
| 🔥 Hard   | Predictive — tracks your move history, exploits tendencies |

---

## 🏆 Other Commands

| Command | Description |
|---------|-------------|
| `/leaderboard` | Top 10 players by coins |
| `/stats` | Your personal match statistics |
| `/stats @user` | Check another player's stats |

---

## 🎨 Features

### Engagement
- 💬 **Sledging system** — trash talk on wickets, low scores, repeated moves
- 🎆 **GIF reactions** — on wickets, sixes, and match wins
- 📣 **Crowd reactions** — dynamic commentary during play
- 🗒️ **Milestone comments** — when you hit 20, 30, 50 runs

### UI
- Live scorecard embeds (auto-updating)
- Ball-by-ball over tracker
- Target & run-rate display in 2nd innings
- Color-coded embeds (gold = batting, teal = bowling, red = OUT)

### Tech
- **One game per channel** — prevents overlapping sessions
- **5-minute timeout** — auto-ends abandoned games
- **Rematch button** — instant replay after match ends
- **SQLite persistence** — stats survive bot restarts
- **Memory fallback** — works without SQLite installed

---

## ⚙️ Configuration

In `.env`:

```env
MAX_OVERS=5              # Default overs per innings
AI_DELAY_MS=1500         # AI thinking delay (ms)
SESSION_TIMEOUT_MS=300000 # 5 minutes inactivity timeout
```

---

## 🛡️ Required Bot Permissions

In your Discord Application → OAuth2 → Bot:

**Scopes:** `bot`, `applications.commands`

**Permissions:**
- Send Messages
- Send Messages in Threads
- Embed Links
- Attach Files
- Read Message History
- Use External Emojis
- Add Reactions
- Use Slash Commands

---

## 🔧 Extending the Bot

### Add Tournament Mode
Create `commands/tournament.js` + `games/tournament.js`. Use the `gameManager.sessions` Map to track multi-game brackets.

### Add Spectator Mode
In `_handleMove`, allow non-participants to watch via ephemeral score updates.

### Custom GIFs
Replace `GIFS` in `utils/flavor.js` with your own links, or integrate the Tenor API for dynamic gif fetching.

### Overs Configuration
Pass `overs` option in `/handcricket pvp @user overs:3` for quick games.

---

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| Commands not showing | Run `node deploy-commands.js`, wait 1hr for global |
| `better-sqlite3` install fails | Run `npm rebuild better-sqlite3` or the bot auto-falls back to memory |
| "Missing Permissions" errors | Check bot role permissions in server |
| Buttons stop working | Interaction tokens expire after 15 min; buttons are invalidated after game ends |

---

## 📜 License

MIT — Build your own arcade with it!
