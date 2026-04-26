// commands/reactions.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Reaction GIFs and messages
const reactions = {
    hype: {
        messages: [
            "🔥 LET'S GOOOOO!",
            "⚡ PUMPED UP!",
            "💪 BRING IT ON!",
            "🚀 HYPED TO THE MAX!",
            "🎉 IT'S GAME TIME!",
            "⭐ READY TO DOMINATE!"
        ],
        color: 0xff6600
    },
    facepalm: {
        messages: [
            "🤦 Are you serious right now?",
            "😩 I can't even...",
            "🤦‍♂️ That was painful to watch",
            "😑 Really? REALLY?",
            "🤦‍♀️ *sighs heavily*",
            "😫 My disappointment is immeasurable"
        ],
        color: 0x808080
    },
    celebrate: {
        messages: [
            "🎊 WOOHOO! CELEBRATION TIME!",
            "🥳 PARTY PARTY PARTY!",
            "🎉 WE DID IT!",
            "🏆 VICTORY DANCE!",
            "✨ TIME TO CELEBRATE!",
            "🎆 CHAMPIONS!"
        ],
        color: 0xffd700
    },
    oof: {
        messages: [
            "😬 Big oof...",
            "💀 That hurt to watch",
            "😵 Ouch...",
            "🤕 Oof size: LARGE",
            "😖 Yikes...",
            "💥 That's gonna leave a mark"
        ],
        color: 0xff0000
    },
    respect: {
        messages: [
            "🫡 Respect! o7",
            "🙏 Mad respect for that",
            "👏 *slow clap* Well played",
            "⭐ That deserves recognition",
            "💯 Respect earned",
            "🎖️ Salute to you!"
        ],
        color: 0x0099ff
    },
    laugh: {
        messages: [
            "😂 LMAO!",
            "🤣 I'M DYING!",
            "😆 That's hilarious!",
            "😹 Can't stop laughing!",
            "💀 I'M DEAD!",
            "🤪 Too funny!"
        ],
        color: 0xffff00
    },
    doubt: {
        messages: [
            "🤨 X to Doubt",
            "🧐 Hmm... suspicious",
            "👀 I see you...",
            "🤔 Press X to doubt",
            "😏 Sure, sure...",
            "🕵️ Something's fishy here"
        ],
        color: 0xff00ff
    },
    gg: {
        messages: [
            "🤝 GG! Well played!",
            "🏆 Good game everyone!",
            "✨ GG WP!",
            "🎮 That was a great match!",
            "👏 GG! Until next time!",
            "🌟 Good game, good game!"
        ],
        color: 0x00ff00
    },
    rage: {
        messages: [
            "😡 RAGE MODE ACTIVATED!",
            "🤬 I'M SO MAD RIGHT NOW!",
            "💢 ARGHHHHH!",
            "😤 THAT'S IT!",
            "🔥 TRIGGERED!",
            "😠 NOT HAPPY!"
        ],
        color: 0xff0000
    },
    shocked: {
        messages: [
            "😱 WHAT?! NO WAY!",
            "🤯 MIND = BLOWN!",
            "😳 I DID NOT SEE THAT COMING!",
            "😲 UNBELIEVABLE!",
            "🫢 OMG!",
            "😵 SHOCKED!"
        ],
        color: 0xff6600
    }
};

// Cricket-specific reactions
const cricketReactions = {
    appeal: [
        "🙋 HOWZAAAAT!!!",
        "🙏 HOW IS THAT?!",
        "👨‍⚖️ THAT'S OUT! SURELY!",
        "📣 APPEAL! UMPIRE!",
        "🎯 PLUMB! GIVE IT!",
        "⚠️ STONE DEAD! OUT!"
    ],
    review: [
        "📺 REVIEW! Let's check that!",
        "🔍 Going upstairs for this one!",
        "🎥 Third umpire, please!",
        "👀 Let's have a look at the replay!",
        "📡 DRS time!",
        "🎬 Review requested!"
    ],
    noball: [
        "🚫 NO BALL! Free hit incoming!",
        "⚠️ NO BALL CALLED!",
        "❌ OVERSTEPPED!",
        "🔴 That's a no ball!",
        "📏 Front foot's over!",
        "🆓 FREE HIT!"
    ],
    wide: [
        "↔️ WIDE! That's going to the boundary!",
        "📏 WIDE BALL!",
        "🎯 Way too wide!",
        "⬅️➡️ WIDE!",
        "🚫 Outside the line!",
        "📊 WIDE! Extra run!"
    ]
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('react')
        .setDescription('Send fun reactions!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('hype')
                .setDescription('Get hyped!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('facepalm')
                .setDescription('Facepalm moment'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('celebrate')
                .setDescription('Celebrate!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('oof')
                .setDescription('Big oof moment'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('respect')
                .setDescription('Pay respects'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('laugh')
                .setDescription('Laugh it out'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('doubt')
                .setDescription('X to doubt'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('gg')
                .setDescription('Good game!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('rage')
                .setDescription('Rage mode!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('shocked')
                .setDescription('Shocked reaction'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('appeal')
                .setDescription('Cricket appeal!'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('review')
                .setDescription('Call for DRS review'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('noball')
                .setDescription('No ball called'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('wide')
                .setDescription('Wide ball called')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        // Handle cricket-specific reactions
        if (['appeal', 'review', 'noball', 'wide'].includes(subcommand)) {
            await handleCricketReaction(interaction, subcommand);
        } else {
            await handleGeneralReaction(interaction, subcommand);
        }
    },
};

async function handleGeneralReaction(interaction, type) {
    const reaction = reactions[type];
    const message = reaction.messages[Math.floor(Math.random() * reaction.messages.length)];

    const embed = new EmbedBuilder()
        .setColor(reaction.color)
        .setDescription(message)
        .setFooter({ text: `Reaction by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleCricketReaction(interaction, type) {
    const messages = cricketReactions[type];
    const message = messages[Math.floor(Math.random() * messages.length)];

    const colors = {
        appeal: 0xff0000,
        review: 0x0099ff,
        noball: 0xff6600,
        wide: 0xffff00
    };

    const embed = new EmbedBuilder()
        .setColor(colors[type])
        .setTitle('🏏 Cricket Reaction')
        .setDescription(message)
        .setFooter({ text: `Called by ${interaction.user.username}` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}