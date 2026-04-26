// commands/cricket.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Cricket Memes Database
const cricketMemes = [
    {
        title: "When you get out for a duck",
        description: "🦆 That awkward walk back to the pavilion...",
        image: "https://media.tenor.com/images/cricket-out-duck/cricket-out.gif",
        color: 0xff0000
    },
    {
        title: "That feeling when you hit a six",
        description: "💪 Straight into the stands!",
        image: null,
        color: 0x00ff00
    },
    {
        title: "Waiting for your turn to bat",
        description: "😴 When you're batting at number 11...",
        image: null,
        color: 0x0099ff
    },
    {
        title: "Rain stops play",
        description: "🌧️ Everyone: Finally, time to go home!",
        image: null,
        color: 0x808080
    },
    {
        title: "Third umpire reviewing for 10 minutes",
        description: "⏰ We've been waiting since the last century...",
        image: null,
        color: 0xffd700
    },
    {
        title: "When the tailender hits a boundary",
        description: "😱 Number 11 showing the top order how it's done!",
        image: null,
        color: 0xff6600
    },
    {
        title: "Catching practice in the outfield",
        description: "🏏 Ball: I'm about to end this man's whole career",
        image: null,
        color: 0xff0000
    },
    {
        title: "LBW appeal",
        description: "🙏 Bowler: HOWZAAAT!!! Umpire: Not out. Bowler: 😭",
        image: null,
        color: 0x0099ff
    }
];

// Cricket Sledges/Trash Talk
const cricketSledges = [
    "Hey mate, you're batting like a number 11! 😂",
    "My grandmother bowls faster than you! 👵",
    "That shot was so bad, even the scoreboard felt embarrassed! 📊",
    "Are you playing cricket or practicing for a dance show? 💃",
    "I've seen better timing on a broken clock! ⏰",
    "You swing like a rusty gate in a storm! 🌪️",
    "That defense has more holes than Swiss cheese! 🧀",
    "You call that bowling? I've seen faster deliveries from Amazon! 📦",
    "Your strike rate is so low, even a snail would overtake you! 🐌",
    "You're dropping more catches than a butterfingers convention! 🧈",
    "That was so wide, even the boundary rope felt lonely! 📏",
    "You're getting out to that? My nan would've smashed it for six! 👵⚡",
    "Your footwork is so bad, you'd trip over the pitch! 👟",
    "That was plumb! How's the umpire's Christmas card looking? 🎄",
    "You're making this look like a Test match in a T20! 🐌",
    "Channel your inner Bradman... oh wait, wrong era! 📜",
    "That's more agricultural than a farmer's market! 🚜",
    "You're slogging harder than a construction worker! 👷",
    "That shot deserved a 'wide' and a counseling session! 🎯",
    "Your economy rate is higher than inflation! 📈"
];

// Cheering Messages
const cheers = [
    "🎉 WHAT A SHOT! Absolutely magnificent!",
    "🔥 ON FIRE! That's how you do it!",
    "⚡ LIGHTNING PACE! Can't touch this!",
    "🏆 CHAMPION PLAYER! Pure class!",
    "💪 DOMINATING! Show them who's boss!",
    "🎯 PERFECT EXECUTION! Textbook stuff!",
    "🌟 BRILLIANT! That's world-class!",
    "👑 KING/QUEEN OF THE GAME! Bow down!",
    "🚀 ROCKET SHOT! Into the stratosphere!",
    "💎 ABSOLUTE GEM! Beautiful cricket!",
    "🎪 ENTERTAINMENT GUARANTEED! What a player!",
    "🔊 CROWD IS GOING WILD! Can you hear them?!",
    "🎭 MASTERCLASS! Writing history out there!",
    "⭐ SUPERSTAR PERFORMANCE! Take a bow!",
    "🎵 MUSIC TO THE EARS! Symphony of cricket!",
    "🌈 PAINTING THE TOWN! Artistry at its finest!",
    "🦅 FLYING HIGH! Unstoppable!",
    "⚔️ WARRIOR SPIRIT! Never backing down!",
    "🎪 SHOWTIME! Give the people what they want!",
    "🏅 HALL OF FAME STUFF! Legendary!"
];

// Celebrations for specific achievements
const celebrations = {
    wicket: [
        "🎯 BOOOOM! WICKET! That's how you do it!",
        "🔥 BOWLED 'EM! Absolute ripper!",
        "⚡ CLEANED UP! Stumps went flying!",
        "🎪 CAUGHT! What a catch! Unbelievable!",
        "👏 GONE! Walk back to the pavilion!",
        "🎉 LBW! Stone dead! Plumb as they come!",
        "💥 RUN OUT! Direct hit! You beauty!",
        "🎯 STUMPED! Lightning hands from the keeper!"
    ],
    four: [
        "🏏 FOUR! Cracking shot!",
        "💥 BOUNDARY! All along the carpet!",
        "⚡ FOUR RUNS! Pierced the field perfectly!",
        "🎯 TO THE FENCE! Quality stroke!",
        "🔥 FOUR! That's finding the gap!",
        "✨ BOUNDARY! Sweet timing!",
        "💪 FOUR! Power and precision!"
    ],
    six: [
        "🚀 SIX! OUT OF THE PARK!",
        "💥 MAXIMUM! Absolutely clobbered!",
        "⭐ SIX! Into the stands!",
        "🔥 MONSTER HIT! That's gone miles!",
        "🌟 GIGANTIC SIX! Still flying!",
        "💪 BOOM! That's out of the stadium!",
        "🎆 SIX! Someone fetch that ball!",
        "⚡ HUGE! That's disappeared!"
    ],
    century: [
        "💯 CENTURY! WHAT AN INNINGS!",
        "👑 100 RUNS! ABSOLUTE LEGEND!",
        "🏆 TON UP! Take a bow champion!",
        "⭐ HUNDRED! Magnificent knock!",
        "🎉 CENTURY! Standing ovation!",
        "💎 100! Pure class all the way!"
    ],
    hatTrick: [
        "🎩 HAT-TRICK! THREE IN THREE!",
        "🔥 HAT-TRICK! UNBELIEVABLE!",
        "⚡ HAT-TRICK! Legendary bowling!",
        "👑 HAT-TRICK! Bowler's dream!"
    ]
};

// Commentary lines
const commentary = [
    "That's a gorgeous stroke through the covers! 🏏",
    "Bowler steams in, and... oh what a delivery! 🔥",
    "The fielder dives, but it's just out of reach! 🤸",
    "Appeal! That looked close! 👨‍⚖️",
    "What a catch! Absolute stunner in the deep! ✨",
    "That's gone straight up... who's under it? 👀",
    "Edges and... SAFE! Slip cordon can't believe it! 😱",
    "Review! Let's see what the third umpire says! 📺",
    "Overthrow! Bonus runs! 🎁",
    "Misfield! That's poor cricket! 😬",
    "Perfect yorker! Right on the money! 🎯",
    "Short ball! Batter ducks under it! 🦆",
    "Driven beautifully through mid-off! 💎",
    "That's a risky shot! High risk, high reward! 🎲",
    "Spin bowling at its finest! Turning square! 🌀",
    "Pace like fire! Batter had no chance! ⚡",
    "Defensive shot. Playing it safe! 🛡️",
    "That's agricultural! Slogging across the line! 🚜"
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cricket')
        .setDescription('Cricket fun commands!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('meme')
                .setDescription('Get a random cricket meme'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('sledge')
                .setDescription('Send some cricket sledging/trash talk')
                .addUserOption(option =>
                    option.setName('target')
                        .setDescription('Who to sledge? (optional)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cheer')
                .setDescription('Send a cheering message')
                .addUserOption(option =>
                    option.setName('player')
                        .setDescription('Who to cheer for? (optional)')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('celebrate')
                .setDescription('Celebrate a cricket moment')
                .addStringOption(option =>
                    option.setName('type')
                        .setDescription('What to celebrate')
                        .setRequired(true)
                        .addChoices(
                            { name: '🎯 Wicket', value: 'wicket' },
                            { name: '🏏 Four', value: 'four' },
                            { name: '🚀 Six', value: 'six' },
                            { name: '💯 Century', value: 'century' },
                            { name: '🎩 Hat-trick', value: 'hatTrick' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('commentary')
                .setDescription('Get a random cricket commentary line')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'meme') {
            await handleMeme(interaction);
        } else if (subcommand === 'sledge') {
            await handleSledge(interaction);
        } else if (subcommand === 'cheer') {
            await handleCheer(interaction);
        } else if (subcommand === 'celebrate') {
            await handleCelebrate(interaction);
        } else if (subcommand === 'commentary') {
            await handleCommentary(interaction);
        }
    },
};

async function handleMeme(interaction) {
    const meme = cricketMemes[Math.floor(Math.random() * cricketMemes.length)];

    const embed = new EmbedBuilder()
        .setColor(meme.color)
        .setTitle(meme.title)
        .setDescription(meme.description)
        .setFooter({ text: '🏏 Cricket Memes' })
        .setTimestamp();

    if (meme.image) {
        embed.setImage(meme.image);
    }

    await interaction.reply({ embeds: [embed] });
}

async function handleSledge(interaction) {
    const target = interaction.options.getUser('target');
    const sledge = cricketSledges[Math.floor(Math.random() * cricketSledges.length)];

    let message = sledge;
    if (target) {
        message = `${target}, ${sledge}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('🔥 SLEDGING TIME!')
        .setDescription(message)
        .setFooter({ text: `Sledged by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCheer(interaction) {
    const player = interaction.options.getUser('player');
    const cheer = cheers[Math.floor(Math.random() * cheers.length)];

    let message = cheer;
    if (player) {
        message = `${player} - ${cheer}`;
    }

    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('📣 CHEER SQUAD!')
        .setDescription(message)
        .setFooter({ text: `Cheered by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCelebrate(interaction) {
    const type = interaction.options.getString('type');
    const celebrationMessages = celebrations[type];
    const message = celebrationMessages[Math.floor(Math.random() * celebrationMessages.length)];

    const colors = {
        wicket: 0xff0000,
        four: 0x00ff00,
        six: 0xffd700,
        century: 0xff6600,
        hatTrick: 0x9900ff
    };

    const embed = new EmbedBuilder()
        .setColor(colors[type])
        .setTitle('🎉 CELEBRATION TIME!')
        .setDescription(message)
        .setFooter({ text: `Celebrated by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCommentary(interaction) {
    const commentaryLine = commentary[Math.floor(Math.random() * commentary.length)];

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎙️ LIVE COMMENTARY')
        .setDescription(commentaryLine)
        .setFooter({ text: 'Cricket Commentary' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}