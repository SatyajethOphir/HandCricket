// ============================================================
//  utils/flavor.js
//  All the funny, hype, and trash-talk content that makes
//  XO-Arena feel alive. Sledges, crowd chants, GIF URLs.
// ============================================================

// ── Number Emojis ─────────────────────────────────────────────
const NUMBER_EMOJI = {
  1: '1️⃣', 2: '2️⃣', 3: '3️⃣',
  4: '4️⃣', 5: '5️⃣', 6: '6️⃣',
};

// ── Sledging Lines ────────────────────────────────────────────
const SLEDGES = {
  OUT: [
    "💀 **HOWZAT!!** Even my grandma bats better.",
    "🤡 You play like a broken calculator — wrong answers every time.",
    "😂 Bro got folded like cheap lawn furniture.",
    "💀 The umpire didn't even bother raising his finger — the ball did it for him.",
    "🎪 Ladies and gentlemen, we have found the world's most entertaining wicket.",
    "☠️ That shot was sponsored by Failure™.",
    "😭 Even AI is crying for you right now.",
    "🪦 RIP to those runs that never made it home.",
    "🤣 Your technique called — it said it quit.",
    "📉 Your stock just hit all-time lows on the cricket exchange.",
  ],
  LOW_SCORE: [
    "😬 Bro treating every run like it's made of gold.",
    "🐢 Slower than a turtle on sedatives.",
    "😴 The crowd fell asleep. TWICE.",
    "🤏 That score is smaller than your courage.",
    "🧱 You're batting like the pitch is made of quicksand.",
  ],
  REPEATED_MOVE: [
    "🔁 Playing the same number again? Bold strategy... or just braindead?",
    "🤖 Predictable detected. Very predictable.",
    "😏 The AI already knew that was coming from miles away.",
    "📖 You're literally an open book. A boring book.",
    "🎯 Pattern spotted! You're basically writing them a manual.",
  ],
  SIX: [
    "🔥 **MAXIMUM!!** That one's in the parking lot!",
    "💥 SIX RUNS! The crowd goes absolutely MENTAL!",
    "🚀 That ball is still travelling!",
    "🎆 **BOOM!** Six of the best!",
    "🏏 The bat just said *choose violence* and won.",
  ],
  WIN: [
    "🏆 **CHAMPION!** Bow down, mortals.",
    "👑 The throne is yours. Don't drop it.",
    "🎊 That was CLINICAL. Textbook domination.",
    "🌟 Legendary performance. Absolutely unreal.",
    "💪 GG EZ — but make it classy.",
  ],
  CLOSE_WIN: [
    "😤 Scraped through, but a win is a win!",
    "🫀 My heart nearly stopped three times watching that.",
    "😅 That was closer than it needed to be, but the W is the W.",
    "🙏 By the skin of your teeth — but you're still the champion!",
  ],
  CROWD_REACTIONS: [
    "🔥 **WHAT A SHOT!** The crowd erupts!",
    "😱 **OH MY!** That was CLOSE!",
    "👏 **BEAUTIFUL CRICKET!** Pure class!",
    "📣 The crowd is on its FEET!",
    "🎺 The stadium band is going wild!",
    "🌊 A WAVE of excitement through the stands!",
    "💨 **DRIVEN!** Through the covers like butter!",
    "🌟 The commentators are speechless!",
  ],
  BOUNDARY: [
    "🏃 **FOUR!** Racing to the boundary!",
    "💨 Raced away to the rope!",
    "🎯 Pierced the gap PERFECTLY!",
  ],
};

// ── GIF URLs (Tenor/Giphy public embed links) ─────────────────
// These are publicly embeddable animated GIFs. Replace with
// your own Tenor API keys for dynamic fetching.
const GIFS = {
  OUT: [
    'https://media.giphy.com/media/l0HlNQ03J5JxX6lva/giphy.gif',
    'https://media.giphy.com/media/3o7btPCcdNniyf0ArS/giphy.gif',
    'https://media.giphy.com/media/26uf2YTgF5upXUTm0/giphy.gif',
  ],
  SIX: [
    'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
    'https://media.giphy.com/media/xT9IgG50Lg7rusRgqA/giphy.gif',
  ],
  WIN: [
    'https://media.giphy.com/media/g9582DNuQppxC/giphy.gif',
    'https://media.giphy.com/media/artj92V8o75VPL7AeQ/giphy.gif',
    'https://media.giphy.com/media/6oMKugqovQnjW/giphy.gif',
  ],
  TOSS_WIN: [
    'https://media.giphy.com/media/Is1O1TWV0LEJi/giphy.gif',
  ],
};

// ── Random picker ─────────────────────────────────────────────
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getSledge(type) {
  return pick(SLEDGES[type] || SLEDGES.OUT);
}

function getGif(type) {
  const list = GIFS[type];
  return list ? pick(list) : null;
}

function getCrowdReaction() {
  return pick(SLEDGES.CROWD_REACTIONS);
}

function getNumberEmoji(n) {
  return NUMBER_EMOJI[n] || `**${n}**`;
}

// ── Score milestones commentary ───────────────────────────────
function getMilestoneComment(score) {
  if (score >= 50)  return '🌟 **FIFTY UP!** Half-century incoming!';
  if (score >= 30)  return '📈 Thirty up! Getting dangerous now.';
  if (score >= 20)  return '✅ Twenty on the board. Building nicely.';
  if (score === 0)  return '🆕 Yet to get off the mark...';
  return null;
}

module.exports = {
  getSledge, getGif, getCrowdReaction, getNumberEmoji,
  getMilestoneComment, pick, NUMBER_EMOJI,
};
