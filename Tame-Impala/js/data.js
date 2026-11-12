/* All site content lives here. Edit this file, every page updates. */
const COVER = (path, file, px = 500) =>
  `https://thumb.wikimedia.org/wikipedia/en/thumb/${path}/${file}/${px}px-${file}`;

window.TI = {
  albums: [
    { id: "innerspeaker", title: "Innerspeaker", year: 2010, date: "21 May 2010",
      cover: COVER("d/dc", "Tame_Impala_-_Innerspeaker.png"),
      blurb: "The debut: fuzzy, dreamy psych-rock made almost entirely by Kevin Parker himself in Western Australia.",
      tracks: ["It Is Not Meant to Be", "Desire Be Desire Go", "Alter Ego", "Lucidity", "Why Won't You Make Up Your Mind?", "Solitude Is Bliss", "Jeremy's Storm", "Expectation", "The Bold Arrow of Time", "Runway, Houses, City, Clouds"] },
    { id: "lonerism", title: "Lonerism", year: 2012, date: "5 October 2012",
      cover: COVER("3/31", "Tame_Impala_-_Lonerism.png"),
      blurb: "A lonelier, more melodic record. It brought 'Elephant' and 'Feels Like We Only Go Backwards'.",
      tracks: ["Be Above It", "Endors Toi", "Apocalypse Dreams", "Mind Mischief", "Music to Walk Home By", "Why Won't They Talk to Me?", "Feels Like We Only Go Backwards", "Keep On Lying", "Elephant", "She Just Won't Believe Me", "Nothing That Has Happened So Far Has Been Anything We Could Control", "Sun's Coming Up"] },
    { id: "currents", title: "Currents", year: 2015, date: "17 July 2015",
      cover: COVER("9/9b", "Tame_Impala_-_Currents.png"),
      blurb: "The synth-pop turn. 'Let It Happen' and 'The Less I Know the Better' made it the band's breakthrough.",
      tracks: ["Let It Happen", "Nangs", "The Moment", "Yes I'm Changing", "Eventually", "Gossip", "The Less I Know the Better", "Past Life", "Disciples", "'Cause I'm a Man", "Reality in Motion", "Love/Paranoia", "New Person, Same Old Mistakes"] },
    { id: "slowrush", title: "The Slow Rush", year: 2020, date: "14 February 2020",
      cover: COVER("5/54", "Tame_Impala_-_The_Slow_Rush.png"),
      blurb: "A record about time, with warm house-influenced grooves and 'Borderline', 'Lost in Yesterday' and 'Is It True'.",
      tracks: ["One More Year", "Instant Destiny", "Borderline", "Posthumous Forgiveness", "Breathe Deeper", "Tomorrow's Dust", "On Track", "Lost in Yesterday", "Is It True", "It Might Be Time", "Glimmer", "One More Hour"] },
    { id: "deadbeat", title: "Deadbeat", year: 2025, date: "17 October 2025",
      cover: COVER("f/f1", "DeadbeatTameImpala.jpeg"),
      blurb: "The newest album: Parker leans into dance music. 12 tracks.",
      tracks: ["My Old Ways", "No Reply", "Dracula", "Loser", "Oblivion", "Not My World", "Piece of Heaven", "Obsolete", "Ethereal Connection", "See You on Monday (You're Lost)", "Afterthought", "End of Summer"] }
  ],

  /* Every id below was checked with YouTube's oEmbed endpoint on 12 Nov 2026 (embedding allowed). */
  songs: [
    { title: "Let It Happen", album: "Currents", year: 2015, yt: "pFptt7Cargc", kind: "Official video" },
    { title: "The Less I Know the Better", album: "Currents", year: 2015, yt: "sBzrzS1Ag_g", kind: "Official video" },
    { title: "Eventually", album: "Currents", year: 2015, yt: "GHe8kKO8uds", kind: "Audio" },
    { title: "Feels Like We Only Go Backwards", album: "Lonerism", year: 2012, yt: "wycjnCCgUes", kind: "Official video" },
    { title: "Elephant", album: "Lonerism", year: 2012, yt: "LnKUD_OztRE", kind: "Video" },
    { title: "Apocalypse Dreams", album: "Lonerism", year: 2012, yt: "DmmvZrBnQ4M", kind: "Audio" },
    { title: "Why Won't You Make Up Your Mind?", album: "Innerspeaker", year: 2010, yt: "3a7jLiSCtpU", kind: "Audio" },
    { title: "Borderline", album: "The Slow Rush", year: 2020, yt: "2g5xkLqIElU", kind: "Official audio" },
    { title: "Patience", album: "Single, 2019", year: 2019, yt: "rUmV-MorIKc", kind: "Official audio" },
    { title: "Lost in Yesterday", album: "The Slow Rush", year: 2020, yt: "utCjuKDXQsE", kind: "Official video" },
    { title: "Is It True", album: "The Slow Rush", year: 2020, yt: "KN8nJFLu1Rk", kind: "Lyric video" },
    { title: "Breathe Deeper", album: "The Slow Rush", year: 2020, yt: "UTwlmgV3pEI", kind: "Video" },
    { title: "Dracula", album: "Deadbeat", year: 2025, yt: "xnP7qKxwzjg", kind: "Official video" },
    { title: "Loser", album: "Deadbeat", year: 2025, yt: "s3a4OQR-10M", kind: "Official video" }
  ],

  live: [
    { title: "Patience", where: "Coachella 2019", yt: "kgNBO2cBJGU", note: "From the weekend Tame Impala headlined Coachella." },
    { title: "Borderline", where: "Glastonbury 2019", yt: "rR1nXbfyzlk", note: "BBC Music's recording of the Glastonbury set." },
    { title: "Patience", where: "Saturday Night Live, 2019", yt: "iToe7b_VfWI", note: "Their TV debut of the new songs." },
    { title: "Borderline", where: "The Tonight Show, 2020", yt: "kQK7q5PH3fY", note: "Studio performance during the Slow Rush release." },
    { title: "Lost in Yesterday", where: "Jimmy Kimmel Live!, 2020", yt: "llqDrq00E28", note: "Filmed with the full band." },
    { title: "Is It True", where: "The Late Show, 2020", yt: "9xva3db1H-8", note: "A big, bright TV performance." },
    { title: "Tiny Desk Concert", where: "NPR Music", yt: "xSDfCwDmJNo", note: "A full 20-minute stripped-back set." }
  ],

  films: [
    { title: "Currents in the Making", length: "1:41", yt: "nfmJilbZCas",
      blurb: "A short behind-the-scenes look at how Kevin Parker made Currents." },
    { title: "Currents: Collectors Edition", length: "2:29", yt: "IMt7oyHP6iw",
      blurb: "A short trailer for the Collectors Edition of Currents." },
    { title: "InnerSpeaker (Episode 2)", length: "0:54", yt: "JqEFRb9gcNs",
      blurb: "A one-minute episode from the InnerSpeaker anniversary series." },
    { title: "InnerSpeaker Memories", length: "15:22", yt: "_o26HtOgnFY",
      blurb: "A longer short film remembering the making of the debut album." },
    { title: "InnerSpeaker, Live from Wave House", length: "1:02:06", yt: "d33C8IE7WnQ",
      blurb: "The whole first album performed live in one hour." }
  ],

  tours: {
    upcoming: [
      { date: "28 May 2027", city: "Manchester", venue: "Co-op Live", extra: "Wet Leg" },
      { date: "1 and 2 Jun 2027", city: "London", venue: "The O2", extra: "Wet Leg" },
      { date: "7 and 8 Jun 2027", city: "Rotterdam", venue: "Ahoy", extra: "Wet Leg" },
      { date: "12 and 13 Jun 2027", city: "Paris", venue: "Accor Arena", extra: "Wet Leg" },
      { date: "17 Jun 2027", city: "Cologne", venue: "Lanxess Arena", extra: "Wet Leg" },
      { date: "30 Jun 2027", city: "Gdynia", venue: "Open'er Festival", extra: "Festival" },
      { date: "4 Jul 2027", city: "Werchter", venue: "Rock Werchter", extra: "Festival" },
      { date: "10 Jul 2027", city: "Lisbon", venue: "NOS Alive", extra: "Festival" }
    ],
    past: [
      { name: "Deadbeat Tour: North America", year: "Jul to Sep 2026", text: "Arena run from Miami (7 July) to Houston (19 September) with Djo and Dominic Fike." },
      { name: "Deadbeat Tour: Australia", year: "Oct 2026", text: "Brisbane, Melbourne, Sydney and Perth with Ninajirachi." },
      { name: "The Slow Rush Tour", year: "2020 to 2023", text: "Postponed by the pandemic, then a huge run of arenas and festivals worldwide." },
      { name: "2019 World Tour", year: "2019", text: "Coachella and Glastonbury appearances plus the first shows with the new songs." },
      { name: "Currents Tour", year: "2015 to 2018", text: "The breakthrough tour, with headline festival slots across the world." },
      { name: "Lonerism Tour", year: "2012 to 2014", text: "The first big international tour, after the success of Lonerism." },
      { name: "Innerspeaker Tour", year: "2010 to 2011", text: "The band's first world tour, playing small clubs and festivals." }
    ]
  },

  band: [
    { name: "Kevin Parker", role: "Vocals, guitar, producer", text: "Writes, records and produces nearly everything himself, from Perth, Western Australia." },
    { name: "Dominic Simper", role: "Bass, guitar", text: "A touring member since the early days." },
    { name: "Jay Watson", role: "Synths, keys, drums", text: "Also records as GUM and POND." },
    { name: "Cam Avery", role: "Bass, backing vocals", text: "Also a member of POND." },
    { name: "Julien Barbagallo", role: "Drums", text: "A French drummer who also plays in his own project." },
    { name: "James Ireland", role: "Live band", text: "Joined the live band in 2025." }
  ],

  timeline: [
    ["2007", "Kevin Parker starts recording as Tame Impala in Perth."],
    ["2010", "Debut album Innerspeaker."],
    ["2012", "Lonerism, with 'Elephant' and 'Feels Like We Only Go Backwards'."],
    ["2013", "'Feels Like We Only Go Backwards' wins APRA Song of the Year."],
    ["2015", "Currents arrives."],
    ["2016", "'Let It Happen' wins APRA Song of the Year."],
    ["2019", "Headlines Coachella and plays Glastonbury."],
    ["2020", "The Slow Rush is released."],
    ["2025", "Deadbeat is released on 17 October."],
    ["2027", "Arena and festival run across the UK and Europe."]
  ],

  shop: [
    { id: "t1", name: "Currents Tour Tee", price: 28, color: "#5e72e4" },
    { id: "t2", name: "Slow Rush Hoodie", price: 55, color: "#ff6b6b" },
    { id: "t3", name: "Lonerism Poster", price: 20, color: "#f3a683" },
    { id: "t4", name: "Deadbeat Cap", price: 25, color: "#7b4fd6" },
    { id: "t5", name: "Innerspeaker Tote", price: 18, color: "#2bb3a3" },
    { id: "t6", name: "Vinyl: Currents", price: 38, color: "#1e272e" }
  ]
};
