// commands/trivia.js
const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Cricket Trivia Questions
const triviaQuestions = [
    {
        question: "Who holds the record for the highest individual score in Test cricket?",
        answer: "Brian Lara (400*)",
        options: ["Sachin Tendulkar", "Brian Lara", "Matthew Hayden", "Don Bradman"],
        difficulty: "Medium"
    },
    {
        question: "What is the maximum number of overs in a One Day International (ODI)?",
        answer: "50 overs per side",
        options: ["40", "45", "50", "60"],
        difficulty: "Easy"
    },
    {
        question: "Who has scored the most runs in ODI cricket history?",
        answer: "Sachin Tendulkar",
        options: ["Virat Kohli", "Ricky Ponting", "Sachin Tendulkar", "Kumar Sangakkara"],
        difficulty: "Easy"
    },
    {
        question: "What does LBW stand for in cricket?",
        answer: "Leg Before Wicket",
        options: ["Leg Before Wicket", "Long Ball Wide", "Left By Winner", "Line Break Wicket"],
        difficulty: "Easy"
    },
    {
        question: "How many balls are in one over in cricket?",
        answer: "6 balls",
        options: ["4", "5", "6", "8"],
        difficulty: "Easy"
    },
    {
        question: "Which country won the first-ever Cricket World Cup in 1975?",
        answer: "West Indies",
        options: ["Australia", "England", "West Indies", "India"],
        difficulty: "Medium"
    },
    {
        question: "What is a 'hat-trick' in cricket?",
        answer: "Taking 3 wickets in 3 consecutive balls",
        options: ["Scoring 3 sixes in a row", "Taking 3 wickets in 3 consecutive balls", "3 catches in one match", "3 centuries in a series"],
        difficulty: "Easy"
    },
    {
        question: "What is the nickname of the Australian cricket team?",
        answer: "The Baggy Greens",
        options: ["The Kangaroos", "The Baggy Greens", "The Aussies", "The Southern Stars"],
        difficulty: "Medium"
    },
    {
        question: "Who has taken the most wickets in Test cricket?",
        answer: "Muttiah Muralitharan",
        options: ["Shane Warne", "Muttiah Muralitharan", "James Anderson", "Anil Kumble"],
        difficulty: "Medium"
    },
    {
        question: "What is a 'yorker' in cricket?",
        answer: "A ball pitched at the batsman's feet",
        options: ["A ball above the batsman's head", "A ball pitched at the batsman's feet", "A wide ball", "A bouncer"],
        difficulty: "Easy"
    }
];

// Cricket Fun Facts
const cricketFacts = [
    "🏏 The longest cricket match ever lasted 14 days! (England vs South Africa, 1939)",
    "🦆 A score of zero is called a 'duck' because the zero looks like a duck's egg!",
    "🏆 The Cricket World Cup trophy is called the 'ICC Cricket World Cup Trophy' and weighs 11 kg!",
    "⚡ The fastest recorded cricket delivery was 161.3 km/h by Shoaib Akhtar!",
    "🎯 Don Bradman's Test batting average of 99.94 is considered unbeatable!",
    "🏟️ The largest cricket stadium is the Narendra Modi Stadium in India (capacity: 132,000)!",
    "🔢 The highest team score in ODI cricket is 498/4 by England!",
    "👴 The oldest Test cricketer was Wilfred Rhodes who played at age 52!",
    "🎾 Cricket balls can travel at over 160 km/h when hit for a six!",
    "📏 A cricket pitch is exactly 22 yards (20.12 meters) long!",
    "🏏 The first-ever international cricket match was between USA and Canada in 1844!",
    "⚡ Chris Gayle holds the record for most sixes in international cricket!",
    "🎩 Taking 3 wickets in 3 balls is called a 'hat-trick' from the old tradition of awarding a hat!",
    "🌙 The first-ever day-night Test match was played in 2015!",
    "📊 Sachin Tendulkar played international cricket for 24 years!",
    "🎯 The fastest century in ODI cricket was scored in just 31 balls by AB de Villiers!",
    "🏆 Australia has won the most Cricket World Cups (5 times)!",
    "⚾ The cricket ball is made of cork covered in leather and weighs between 155-163 grams!",
    "👥 A cricket team consists of 11 players on the field!",
    "🎪 The Indian Premier League (IPL) is the richest cricket league in the world!"
];

// Cricket Records
const cricketRecords = [
    {
        title: "Highest Individual Score (Test)",
        record: "Brian Lara - 400*",
        description: "Against England in 2004",
        color: 0xffd700
    },
    {
        title: "Most Test Wickets",
        record: "Muttiah Muralitharan - 800 wickets",
        description: "The spin wizard from Sri Lanka",
        color: 0xff0000
    },
    {
        title: "Most ODI Runs",
        record: "Sachin Tendulkar - 18,426 runs",
        description: "The Master Blaster",
        color: 0x0099ff
    },
    {
        title: "Fastest ODI Century",
        record: "AB de Villiers - 31 balls",
        description: "Against West Indies in 2015",
        color: 0x00ff00
    },
    {
        title: "Most Sixes in International Cricket",
        record: "Chris Gayle - 553 sixes",
        description: "The Universe Boss",
        color: 0xff6600
    },
    {
        title: "Best Test Batting Average",
        record: "Don Bradman - 99.94",
        description: "The immortal average",
        color: 0xffd700
    },
    {
        title: "Most Catches (Non-wicketkeeper)",
        record: "Rahul Dravid - 210 catches",
        description: "Safe as houses",
        color: 0x9900ff
    },
    {
        title: "Fastest Test Century",
        record: "Brendon McCullum - 54 balls",
        description: "Against Australia in 2016",
        color: 0x00ff00
    }
];

module.exports = {
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Cricket trivia and facts!')
        .addSubcommand(subcommand =>
            subcommand
                .setName('question')
                .setDescription('Get a random cricket trivia question'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('fact')
                .setDescription('Get a random cricket fact'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('record')
                .setDescription('Get a cricket world record')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'question') {
            await handleTrivia(interaction);
        } else if (subcommand === 'fact') {
            await handleFact(interaction);
        } else if (subcommand === 'record') {
            await handleRecord(interaction);
        }
    },
};

async function handleTrivia(interaction) {
    const trivia = triviaQuestions[Math.floor(Math.random() * triviaQuestions.length)];

    const embed = new EmbedBuilder()
        .setColor(0x0099ff)
        .setTitle('🎯 Cricket Trivia')
        .setDescription(`**${trivia.question}**\n\n||${trivia.answer}|| (Click to reveal answer)`)
        .addFields(
            { name: 'Difficulty', value: trivia.difficulty, inline: true }
        )
        .setFooter({ text: 'Think you know the answer? Click to reveal!' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleFact(interaction) {
    const fact = cricketFacts[Math.floor(Math.random() * cricketFacts.length)];

    const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('💡 Cricket Fact')
        .setDescription(fact)
        .setFooter({ text: 'Did you know?' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleRecord(interaction) {
    const record = cricketRecords[Math.floor(Math.random() * cricketRecords.length)];

    const embed = new EmbedBuilder()
        .setColor(record.color)
        .setTitle(`🏆 ${record.title}`)
        .setDescription(`**${record.record}**\n\n${record.description}`)
        .setFooter({ text: 'Cricket World Records' })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}