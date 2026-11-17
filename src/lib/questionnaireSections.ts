/**
 * Helper utilities for structuring questionnaire items into official DepEd
 * topic sections with directions and continuous numbering.
 */

export interface QuestionnaireSection {
  partNumber: string; // e.g. "I", "II", "III"
  title: string;      // e.g. "Part I: Adding Similar Fractions (Items 1–5)"
  topic: string;      // e.g. "Adding Similar Fractions"
  itemRange: string;  // e.g. "Items 1–5" or "Item 1"
  startItem: number;  // 1-indexed start item number
  endItem: number;    // 1-indexed end item number
  itemCount: number;  // total items in this section
  instructions: string; // Auto-generated DepEd directions
  passageTitle?: string;
  passageText?: string;
  passageImage?: string;
  author?: string;
  referenceType?: 'poem' | 'article' | 'advisory' | 'infographic';
}

// Auto-directions helper based on topic/subject keywords
export function getTopicInstructions(topicName: string, subject: string): string {
  const t = (topicName || "").toLowerCase();
  if (t.includes("fraction") || /\bratios?\b/i.test(t) || t.includes("rational")) {
    return "Directions: Perform the indicated operations and express all answers in simplest / lowest terms.";
  }
  if (
    t.includes("integer") ||
    t.includes("equation") ||
    t.includes("algebra") ||
    t.includes("expression")
  ) {
    return "Directions: Solve each algebraic or numerical problem carefully. Choose the letter of the correct answer.";
  }
  if (
    t.includes("angle") ||
    t.includes("geometry") ||
    t.includes("circle") ||
    t.includes("triangle") ||
    t.includes("polygon")
  ) {
    return "Directions: Analyze the geometric figures and properties described. Select the letter corresponding to the correct answer.";
  }
  if (t.includes("vocabulary") || t.includes("context") || t.includes("meaning")) {
    return "Directions: Read each context clue carefully and determine the meaning of the underlined or highlighted concept.";
  }
  if (t.includes("comprehension") || t.includes("inference") || t.includes("theme")) {
    return "Directions: Based on the reading selection, answer the following comprehension and analysis questions.";
  }
  return subject === "Math"
    ? "Directions: Read each math problem carefully, solve for the correct value, and shade the corresponding letter."
    : "Directions: Read each question carefully and select the best answer from the given choices.";
}

export const ROMAN_NUMERALS = [
  "I",
  "II",
  "III",
  "IV",
  "V",
  "VI",
  "VII",
  "VIII",
  "IX",
  "X",
  "XI",
  "XII",
  "XIII",
  "XIV",
  "XV",
  "XVI",
  "XVII",
  "XVIII",
  "XIX",
  "XX",
];

/**
 * Builds continuous numbering across topic groups and generates official DepEd
 * section headers and instructions.
 */
export function buildTopicSections(
  groupedQuestions: { topic: string; questions: any[] }[],
  subject: string
): {
  sections: QuestionnaireSection[];
  orderedQuestions: any[];
} {
  const sections: QuestionnaireSection[] = [];
  const orderedQuestions: any[] = [];
  let currentItemNumber = 1;

  groupedQuestions.forEach((group) => {
    if (!group.questions || group.questions.length === 0) return;

    const startItem = currentItemNumber;
    const groupCount = group.questions.length;
    const endItem = startItem + groupCount - 1;
    const partNumber = ROMAN_NUMERALS[sections.length] || String(sections.length + 1);
    const itemRange = startItem === endItem ? `Item ${startItem}` : `Items ${startItem}–${endItem}`;
    const title = `Part ${partNumber}: ${group.topic} (${itemRange})`;
    const instructions = getTopicInstructions(group.topic, subject);

    sections.push({
      partNumber,
      title,
      topic: group.topic,
      itemRange,
      startItem,
      endItem,
      itemCount: groupCount,
      instructions,
    });

    group.questions.forEach((q) => {
      orderedQuestions.push({
        ...q,
        number: currentItemNumber,
        sectionPart: partNumber,
        sectionTitle: title,
      });
      currentItemNumber++;
    });
  });

  return { sections, orderedQuestions };
}

/**
 * Clusters questions strictly by overarching topic to prevent micro-fragmentation.
 * 1. Questions belonging to the same topic are grouped together contiguously.
 * 2. Short questionnaires (<= 6 items from worksheets or quizzes) are kept under 1 unified Part
 *    so every number does NOT get an isolated direction.
 * 3. Any stray 1-item micro-topics in multi-item assessments are merged into their dominant or
 *    compatible topic group so every Part has a substantive block of items.
 * 4. Generates continuous numbering (1 to N) matching the official DepEd 50-item OMR bubble sheet.
 */
export function clusterQuestionsByTopic(
  questions: any[],
  subject: string,
  options?: { mainTopic?: string; assessmentType?: string }
): {
  sections: QuestionnaireSection[];
  orderedQuestions: any[];
} {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { sections: [], orderedQuestions: [] };
  }

  const fallbackSubject = subject === "Math" ? "Mathematics" : subject || "General";
  const mainTopic = (options?.mainTopic || "").trim();

  // Short quiz or worksheet extract (<= 6 items): Keep under ONE topic part with ONE direction.
  if (questions.length <= 6) {
    const topicTitle = mainTopic || questions[0]?.topic || `${fallbackSubject} Exercises`;
    const instructions = getTopicInstructions(topicTitle, subject);
    const sections: QuestionnaireSection[] = [
      {
        partNumber: "I",
        title: `Part I: ${topicTitle} (Items 1–${questions.length})`,
        topic: topicTitle,
        itemRange: questions.length === 1 ? "Item 1" : `Items 1–${questions.length}`,
        startItem: 1,
        endItem: questions.length,
        itemCount: questions.length,
        instructions,
      },
    ];

    const orderedQuestions = questions.map((q, idx) => ({
      ...q,
      number: idx + 1,
      sectionPart: "I",
      sectionTitle: sections[0].title,
    }));

    return { sections, orderedQuestions };
  }

  // Group questions by normalized topic name
  const topicBuckets = new Map<string, any[]>();
  for (const q of questions) {
    let t = (q?.topic || q?.competency || mainTopic || `${fallbackSubject} Competencies`).trim();
    // Strip common noisy prefixes like "Activity 1: ", "Session 2 - "
    t = t.replace(/^(module\s*\d+|session\s*\d+|activity\s*\d+)[\s:\-–—]+/i, "").trim();
    if (!t) t = mainTopic || `${fallbackSubject} Competencies`;

    if (!topicBuckets.has(t)) {
      topicBuckets.set(t, []);
    }
    topicBuckets.get(t)!.push(q);
  }

  // Convert to array of groups
  let groups: { topic: string; questions: any[] }[] = [];
  topicBuckets.forEach((qs, topic) => {
    groups.push({ topic, questions: qs });
  });

  // Consolidate micro-groups (< 2 items) if other groups exist
  if (groups.length > 1) {
    const multiItemGroups = groups.filter((g) => g.questions.length >= 2);
    const singleItemGroups = groups.filter((g) => g.questions.length < 2);

    if (multiItemGroups.length > 0 && singleItemGroups.length > 0) {
      for (const single of singleItemGroups) {
        // Find best match or fallback to the largest group
        const singleWords = single.topic.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        const match =
          multiItemGroups.find((g) => singleWords.some((w) => g.topic.toLowerCase().includes(w))) ||
          multiItemGroups[0];
        match.questions.push(...single.questions);
      }
      groups = multiItemGroups;
    } else if (multiItemGroups.length === 0) {
      // If all groups have only 1 item, consolidate into 1 unified Part
      const unifiedTopic = mainTopic || `${fallbackSubject} Assessment`;
      groups = [{ topic: unifiedTopic, questions: questions }];
    }
  }

  return buildTopicSections(groups, subject);
}

/**
 * Derives topic sections from a list of questions (uses robust topic clustering).
 */
export function deriveSectionsFromQuestions(
  questions: any[],
  subject: string,
  mainTopic?: string
): QuestionnaireSection[] {
  return clusterQuestionsByTopic(questions, subject, { mainTopic }).sections;
}

export interface ReferenceMaterial {
  passageTitle: string;
  referenceType: 'poem' | 'article' | 'advisory' | 'infographic';
  passageText: string;
  passageImage?: string;
  author?: string;
  source?: string;
}

export const PHIL_IRI_REFERENCES_BY_GRADE: Record<number, Record<string, ReferenceMaterial>> = {
  7: {
    'selection-a': {
      passageTitle: 'What Little Things!',
      referenceType: 'poem',
      author: 'Madison Julius Cawein',
      passageText: `What Little Things!
By Madison Julius Cawein
From "One Day and Another"

    What little things are those
    That hold our happiness!
    A smile, a glance, a rose
    Dropped from her hair or dress;
    A word, a look, a touch,
    These are so much, so much.

    An air we can't forget;
    A sunset's gold that gleams;
    A spray of mignonette,
    Will fill the soul with dreams
    More than all history says,
    Or romance of old days.

    For of the human heart,
    Not brain, is memory;
    These things it makes a part
    Of its own entity;
    The joys, the pains whereof
    Are the very food of love.`,
    },
    'selection-b': {
      passageTitle: 'Plant Intelligence',
      referenceType: 'article',
      author: 'Lyra B. Bedis',
      passageText: `Plant Intelligence
By Lyra B. Bedis

1. Plants are considered as life-support on Earth because of the countless things they provide to the entire biosphere. With their great significance and surprising qualities, many scientists were drawn to consider whether plants have feelings or possess some degree of intelligence. While many people believe that plants don't have any emotions as people do, plants do show signs of responding to their environment. At present, many studies have been conducted to discover the possibility that plants exhibit intelligence or at the least if they can feel.

2. Many plant biologists and botanists use the term "neural activity" to describe plant behavior despite the fact that plants don't have brains or neurons. One remarkable study that demonstrates such activity of plants was done by Bohm J., et. al. (2016) (as cited by Trewavas, 2016) on a Venus fly-trap, a plant that captures and consumes a variety of small flying insects. After carefully examining the behavior of the said carnivorous plant, the researchers concluded that the Venus fly-trap can actually "count" up to five. Their assumption was based on the following observations: 1) As a fly-trap hair is touched the first time, the plant makes no response; 2) When a second hair is touched within 20 seconds, the open petals of the plant snap shut, trapping its potential meal; 3) As the insect begins to struggle, at the third touch of a plant hair, the plant again makes no response; 4) The same lack of response occurs the fourth time a plant hair is stimulated; and 5) Only with the fifth hair touch do the plant's digestive enzymes start the process of digesting its prey.

3. The abovementioned observations can be interpreted as the fly-trap's knowledge on when best to attack prey and avoid false starts. These may not be an indication of a plant's intelligence that is comparable to humans but these show that plants somehow feel because of their response to their environment.`,
    },
    'selection-c': {
      passageTitle: "Get to Know PAGASA's Rainfall Warnings",
      referenceType: 'advisory',
      author: 'Ma. Glecita C. Columna',
      passageText: `Get to Know PAGASA's Rainfall Warnings
By Ma. Glecita C. Columna

The Philippines is visited by an average of 20 typhoons a year. Some are very strong, bringing heavy rains and causing floods in many areas. In 2012, PAGASA started using color-coded rainfall advisories. These were classified into three levels: Yellow, Orange, and Red.

• Yellow Rainfall Warning: Heavy rainfall of 7.5 to 15 mm in an hour, which may continue for the next two hours. Flooding is possible in low-lying and flood-prone areas. The public is advised to monitor weather bulletin updates.

• Orange Rainfall Warning: Intense rainfall of 15 to 30 mm in an hour, which may continue for the next two hours. Flooding is threatening/expected in affected areas. Residents must be alert and prepare for possible evacuation.

• Red Rainfall Warning: Torrential rainfall of more than 30 mm in an hour, which may continue for the next two hours (or over 65 mm in 3 hours). Serious and severe flooding is expected. Communities and residents should take immediate action and evacuate to safe grounds.

Through these color-coded rainfall warnings, citizens become better prepared for typhoons and flood hazards.`,
    },
    'selection-d': {
      passageTitle: 'Solid Waste Management',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/solid_waste_management.png',
      passageText: `DENR-EMB Region 1 Official Infographic: Republic Act No. 9003 (Ecological Solid Waste Management Act of 2000).

Key Facts & Waste Reduction Guidelines:
• An average person produces approximately 0.7 kg (1.5 lbs / 4.5 lbs) of waste daily.
• Waste Hierarchy: Rethink > Reduce > Reuse > Recycle > Recover > Proper Disposal.
• Refer to the official DENR-EMB visual guide for waste reduction practices, segregated collection rules, and ecological preservation mandates.`,
    },
  },
  8: {
    'selection-a': {
      passageTitle: "Africa's Plea",
      referenceType: 'poem',
      author: 'Roland Tombekai Dempster',
      passageText: `AFRICA'S PLEA
By Roland Tombekai Dempster

I am not you-
but you will not
give me chance,
will not let me be me.

"If I were you"-
but you know
I am not you,
yet you will not
let me be me.

You meddle, interfere
in my affairs
as if they were yours
and you were me.

You are unfair, unwise,
foolish to think
that I can be you,
talk, act
and think like you.

God made me me.
He made you you.
For God's sake
Let me be me.`,
    },
    'selection-b': {
      passageTitle: 'Dinagsa Festival: Colorful Hues of Gaiety',
      referenceType: 'article',
      author: 'Kristine Mae J. Lacson',
      passageText: `Dinagsa Festival: Colorful Hues of Gaiety
By Kristine Mae J. Lacson

1. Traditionally known as the Capital of the World's Festivities, Philippines is rich in festivals with more than 42,000 known festivities, a testament of how Filipinos love colorful celebrations. At the northern tip of the Negros Island is Cadiz City where the vibrant and famous Dinagsa Festival has successfully earned the coastal city a distinctive spot on the map of Philippine festivities.

2. Dinagsa Festival stemmed from Ati-Atihan Festival, then a brainchild of the parish priests to strategically lead the people to pay homage to Sto. Niño de Cadiz, eventually diverting them from engaging in cockfighting. As there were Ati-Atihan Festivals in other localities, the city government changed Cadiz Ati-Atihan Festival to Dinagsa Festival, from the local term "dagsa" that means to come together. This was inspired by the historical event on May 7, 1967 when 12 sperm whales were washed ashore, thus Cadiz has been known as the City of Whales.

3. Just like the whales that were washed ashore in numbers, people from all walks of life, locals and foreigners alike, come in throngs to experience the revelry of the Dinagsa Festival every January. The streets are a sea of sweet memories of colorfully painted faces beaming with merriment as they enjoy the "Lamhitanay sa Dalan", a joyous practice of staining people's faces with multi-colored water-based paint while roaming and street dancing around the city from dusk until dawn. The year-starter celebration then becomes more than just an event to witness warriors in black body paint and garbed in colorful tribal costumes dance along the streets to the loud rhythmic drumbeats. It has also become a reason to go back to one's beloved hometown with alumni celebrating school reunions as part of the city fiesta.

4. With its deep religious and cultural roots, Dinagsa Festival highlights not only the tourism and economic development of the city, but also the familial season to reunite with loved ones and once again pay homage with the joyful cries, "Viva! Viva! Pit Señor!"`,
    },
    'selection-c': {
      passageTitle: 'The Negro Speaks of Rivers',
      referenceType: 'poem',
      author: 'Langston Hughes',
      passageText: `The Negro Speaks of Rivers
By Langston Hughes

    I've known rivers:
    I've known rivers ancient as the world and older than the
    Flow of human blood in human veins.

    My soul has grown deep like the rivers.

    I bathed in the Euphrates when dawns were young.
    I built my hut near the Congo and it lulled me to sleep.
    I looked upon the Nile and raised the pyramids above it.
    I heard the singing of the Mississippi when Abe Lincoln
    Went down to New Orleans, and I've seen its muddy
    Bosom turn all golden in the sunset.

    I've known rivers:
    Ancient, dusky rivers.

    My soul has grown deep like the rivers.`,
    },
    'selection-d': {
      passageTitle: 'Deforestation',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/deforestation.png',
      passageText: `Official Infographic: Deforestation and Forest Destruction

Key Ecological Data & Global Impact:
• 80% of the world's forests have already been destroyed.
• Massive forest clearing is driven by agriculture, commercial logging, and cattle grazing.
• Burning and forest degradation are prime contributors to greenhouse gas emissions and global warming.
• Extreme deforestation accelerates animal extinction and loss of natural biodiversity over the next 25 years.
• Consult the visual infographic for quantitative charts on global tree cover loss and conservation imperatives.`,
    },
  },
  9: {
    'selection-a': {
      passageTitle: 'The Road Not Taken',
      referenceType: 'poem',
      author: 'Robert Frost',
      passageText: `The Road Not Taken
By Robert Frost

    Two roads diverged in a yellow wood,
    And sorry I could not travel both
    And be one traveler, long I stood
    And looked down one as far as I could
    To where it bent in the undergrowth;

    Then took the other, as just as fair,
    And having perhaps the better claim,
    Because it was grassy and wanted wear;
    Though as for that the passing there
    Had worn them really about the same,

    And both that morning equally lay
    In leaves no step had trodden black.
    Oh, I kept the first for another day!
    Yet knowing how way leads on to way,
    I doubted if I should ever come back.

    I shall be telling this with a sigh
    Somewhere ages and ages hence:
    Two roads diverged in a wood, and I—
    I took the one less traveled by,
    And that has made all the difference.`,
    },
    'selection-b': {
      passageTitle: 'Depression: How Serious Can It Get?',
      referenceType: 'article',
      author: 'Isidro Arada Jr.',
      source: 'World Health Organization (WHO)',
      passageText: `Depression: How Serious Can It Get?
Written by Isidro Arada Jr. (Source: World Health Organization)

1. Depression is a common mental disorder, and anyone can suffer from it. As the leading cause of poor health globally, the World Health Organization (WHO) explains in an article titled "Depression" about many unknown characteristics of depression that most people are unaware of.

2. First, it is characterized by sadness or displeasure. Many people find themselves losing interest in something they previously enjoyed doing and sometimes wonder why. In fact, these instances show why a lot of people get burned out from their jobs or hobbies easily and tend to fail afterwards. It is also discussed that someone who manifests depression can have sleep disturbances and loss of appetite that can lead to serious health conditions. Lastly, the article describes how common tiredness and poor concentration can be observed from someone who is depressed. Among all its characteristics, these are the usual symptoms that we see from people who suffer depression.

3. The WHO encourages everyone to be aware of these characteristics and aid those who show these effects as depression can be long-lasting or recurrent and can dramatically affect a person's ability to function and live a rewarding life.`,
    },
    'selection-c': {
      passageTitle: 'Tsunamis',
      referenceType: 'article',
      author: 'Justine Paul Alimento',
      source: 'National Geographic',
      passageText: `Tsunamis
Questions written by Justine Paul Alimento (Source: National Geographic)

1. A tsunami is a series of ocean waves that sends surges of water, sometimes reaching heights of over 100 feet (30.5 meters), onto land. These walls of water can cause widespread destruction when they crash ashore.

2. These awe-inspiring waves are typically caused by large, undersea earthquakes at tectonic plate boundaries. When the ocean floor at a plate boundary rises or falls suddenly, it displaces the water above it and launches the rolling waves that will become a tsunami.

3. Most tsunamis–about 80 percent–happen within the Pacific Ocean's "Ring of Fire," a geologically active area where tectonic shifts make volcanoes and earthquakes common. Tsunamis may also be caused by underwater landslides or volcanic eruptions. They may even be launched, as they frequently were in Earth's ancient past, by the impact of a large meteorite plunging into an ocean.

4. Tsunamis race across the sea at up to 500 miles (805 kilometers) an hour—about as fast as a jet airplane. At that pace, they can cross the entire expanse of the Pacific Ocean in less than a day. And their long wavelengths mean they lose very little energy along the way.

5. In deep ocean, tsunami waves may appear only a foot or so high. But as they approach shoreline and enter shallower water they slow down and begin to grow in energy and height. The tops of the waves move faster than their bottoms do, which causes them to rise precipitously.

6. A tsunami's trough, the low point beneath the wave's crest, often reaches shore first. When it does, it produces a vacuum effect that sucks coastal water seaward and exposes harbor and sea floors. This retreating of sea water is an important warning sign of a tsunami, because the wave's crest and its enormous volume of water typically hit shore five minutes or so later. Recognizing this phenomenon can save lives.

7. A tsunami is usually composed of a series of waves, called a wave train, so its destructive force may be compounded as successive waves reach shore. People experiencing a tsunami should remember that the danger may not have passed with the first wave and should await official word that it is safe to return to vulnerable locations.

8. Some tsunamis do not appear on shore as massive breaking waves but instead resemble a quickly surging tide that inundates coastal areas. The best defense against any tsunami is early warning that allows people to seek higher ground. The Pacific Tsunami Warning System, a coalition of 26 nations headquartered in Hawaii, maintains a web of seismic equipment and water level gauges to identify tsunamis at sea.`,
    },
    'selection-d': {
      passageTitle: 'Brain Aneurysms',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/aneurysm.png',
      passageText: `Official Infographic: Brain Aneurysms - What You Need to Know

Key Medical Facts & Symptoms:
• An aneurysm is a weak, bulging spot in the wall of a brain artery that can balloon and rupture under blood pressure.
• 1 in 50 people may have an unruptured brain aneurysm.
• Rupture leads to subarachnoid hemorrhage: approximately 15% of patients die before reaching medical care.
• More prevalent in women (about 3:2 ratio).
• Early detection and awareness of warning symptoms (such as sudden, extremely severe headache) are critical for survival.`,
    },
  },
  10: {
    'selection-a': {
      passageTitle: 'Still I Rise',
      referenceType: 'poem',
      author: 'Maya Angelou',
      passageText: `Still I Rise
By Maya Angelou

    You may write me down in history
    With your bitter, twisted lies,
    You may trod me in the very dirt
    But still, like dust, I'll rise.

    Does my sassiness upset you?
    Why are you beset with gloom?
    'Cause I walk like I've got oil wells
    Pumping in my living room.

    Just like moons and like suns,
    With the certainty of tides,
    Just like hopes springing high,
    Still I'll rise.

    Did you want to see me broken?
    Bowed head and lowered eyes?
    Shoulders falling like teardrops,
    Weakened by my soulful cries?

    Does my haughtiness offend you?
    Don't you take it awful hard?
    'Cause I laugh like I've got gold mines
    Diggin' in my own backyard.

    You may shoot me with your words,
    You may cut me with your eyes,
    You may kill me with your hatefulness,
    But still, like air, I'll rise.

    Out of the huts of history's shame
    I rise
    Up from a past that's rooted in pain
    I rise
    I'm a black ocean, leaping and wide,
    Welling and swelling I bear in the tide.

    Leaving behind nights of terror and fear
    I rise
    Into a daybreak that's wondrously clear
    I rise
    Bringing the gifts that my ancestors gave,
    I am the dream and the hope of the slave.
    I rise
    I rise
    I rise.`,
    },
    'selection-b': {
      passageTitle: 'Mental Health, Too',
      referenceType: 'article',
      author: 'Justine Paul F. Alimento',
      passageText: `Mental Health, Too
Written by Justine Paul F. Alimento

1. Prevention is better than cure. Mental health comprises our emotional, psychological, and social well-being. It impacts how we feel, think, and behave every day. Additionally, it is our capacity to make choices, form connections, and influence the environment in which we live in. It is a fundamental human right. Furthermore, it is essential for our socioeconomic and personal growth.

2. Mental health is important because it affects everything. By taking care of it, we can be resilient and recover quickly from anything. Anyone out there can have a miserable day, but that does not necessarily indicate that their life is horrible. The important thing is how we handle it and sustain our mental well-being.

3. When our minds are in good shape, we appreciate our lives, our surroundings, and the people that inhabit them. We can take any risks, learn new things, and innovate. We will be better equipped to handle challenging situations in both our work and personal life. We may experience the pain and frustration that can come from a loved one's passing, a job loss, and other tough situations, but eventually, we are able to move on and resume enjoying our lives.

4. Mental illness is common. It can happen at any age, from childhood to later in adult lives, although most cases start at a younger age. It can have short-term or long-term impacts. Besides this, it is also possible to experience many mental health disorders simultaneously.

5. You may be more likely to have a mental disorder if you have certain risk factors, such as: childhood abuse, trauma, or neglect, experiencing discrimination and racism, losing someone close to you, severe or long-term stress, domestic violence, bullying or other abuse as an adult, having a long-term physical health condition, unemployment or losing your job, and other lifestyle factors.

6. According to the World Health Organization (WHO), among Filipino children aged 5 to 15, 10% to 15% are affected by mental health problems and 6.8% of Filipino students aged 13 to 17 have attempted suicide at least once within a year before the 2015 Global School-based Student Health survey. Untreated mental illness can cause serious issues with emotion, behavior, and physical health.

7. To prevent this, we should make social connections, talk to someone you trust, get enough sleep, eat a healthy diet, get physical exercise, learn new skills, meditate daily, and ask for help when needed. The most priceless gift that God has given us is our life.`,
    },
    'selection-c': {
      passageTitle: 'Arachne',
      referenceType: 'article',
      author: 'Jovie R. Cruz',
      source: 'Greek Mythology',
      passageText: `Arachne
From Greek Mythology (Adapted by Jovie R. Cruz)

1. In the kingdom of Lydia (an ancient area of Anatolia, which is in modern-day Turkey) there lived a girl, named Arachne. She was very good at weaving, and her reputation for embroidery soon spread. Athena, the goddess of (among many other things) spinners and embroiderers, was considered by many to have been Arachne's tutor, but Arachne refused to give the goddess any credit for having taught her how to weave so beautifully.

2. Indeed, so sure of her own weaving abilities was she, that Arachne even boldly challenged Athena to a weaving contest. Athena turned up in disguise as an old woman, advising the young weaver to be more modest about her achievements. Arachne was scornful, so Athena – angered by the girl's arrogance – revealed her true identity and accepted the challenge Arachne had proposed.

3. The two competitors chose the subject of their tapestries with care: while Athena showed the twelve Olympian gods in hers, she wove in a little detail in each of the four corners, showing what happens to uppity mortals who think they can defy the gods. Conversely, Arachne depicted the most outrageous things the gods had got up to – in particular, Zeus' track record in 'seducing' or abducting young maidens to satisfy his own lust.

4. Arachne's work was perfect, and Athena had to admit it. But, being a goddess, she didn't have to like it. What's the use of being a deity if you can't throw your weight about from time to time? So, Athena tore up Arachne's beautiful work and struck her down. Arachne was so downcast by this, that she hanged herself. Athena was vindictive and refused to give Arachne peace in death. So, she turned the dead girl into a spider, so that she would be doomed to weave and spin for all time.`,
    },
    'selection-d': {
      passageTitle: 'Transforming Philippine Agriculture',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/transforming_agriculture.png',
      passageText: `Department of Agriculture Official Infographic: Transforming Philippine Agriculture Toward a Food-Secure and Resilient Philippines

Key Strategic Pillars & Frameworks:
• Modernization: Technology adoption, farm mechanization, and digital agriculture platforms.
• Industrialization: Agri-industrial business corridors, agro-processing facilities, and export market expansion.
• Consolidation: Cooperative farming, block farming, and land clustering to achieve economies of scale.
• Professionalization: Capacity building for young farmers, agri-entrepreneurship programs, and agricultural extension services.
• Consult the official DA visual diagram for policy targets, agricultural productivity metrics, and farm development roadmaps.`,
    },
  },
};

export const PHIL_IRI_G7_REFERENCES = PHIL_IRI_REFERENCES_BY_GRADE[7];
export const PHIL_IRI_G8_REFERENCES = PHIL_IRI_REFERENCES_BY_GRADE[8];
export const PHIL_IRI_G9_REFERENCES = PHIL_IRI_REFERENCES_BY_GRADE[9];
export const PHIL_IRI_G10_REFERENCES = PHIL_IRI_REFERENCES_BY_GRADE[10];

export function matchReferenceMaterial(
  title: string,
  text: string = '',
  options?: { partIdx?: number; isPhilIri?: boolean; gradeLevel?: number }
): ReferenceMaterial {
  const g = options?.gradeLevel && options.gradeLevel >= 7 && options.gradeLevel <= 10 ? options.gradeLevel : 7;
  const gradeRefs = PHIL_IRI_REFERENCES_BY_GRADE[g] || PHIL_IRI_REFERENCES_BY_GRADE[7];
  const combined = `${title} ${text}`.toLowerCase();

  // Grade 8 selections
  if (
    combined.includes("africa's plea") ||
    combined.includes("africas plea") ||
    combined.includes("roland tombekai") ||
    combined.includes("dempster")
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[8]['selection-a'];
  }
  if (
    combined.includes('dinagsa') ||
    combined.includes('cadiz') ||
    combined.includes('lamhitanay')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[8]['selection-b'];
  }
  if (
    combined.includes('negro speaks of rivers') ||
    combined.includes('langston hughes') ||
    combined.includes('euphrates')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[8]['selection-c'];
  }
  if (
    combined.includes('deforestation') ||
    combined.includes('forest destruction') ||
    combined.includes('greenhouse gas emissions')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[8]['selection-d'];
  }

  // Grade 9 selections
  if (
    combined.includes('road not taken') ||
    combined.includes('robert frost') ||
    combined.includes('two roads diverged')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[9]['selection-a'];
  }
  if (
    combined.includes('depression') &&
    (combined.includes('serious') || combined.includes('disorder') || combined.includes('who'))
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[9]['selection-b'];
  }
  if (
    combined.includes('tsunami') ||
    combined.includes('tsunamis') ||
    combined.includes('ring of fire')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[9]['selection-c'];
  }
  if (
    combined.includes('aneurysm') ||
    combined.includes('brain aneurysm') ||
    combined.includes('ruptured aneurysm')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[9]['selection-d'];
  }

  // Grade 10 selections
  if (
    combined.includes('still i rise') ||
    combined.includes('maya angelou')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[10]['selection-a'];
  }
  if (
    combined.includes('mental health, too') ||
    combined.includes('mental health too') ||
    (combined.includes('mental health') && combined.includes('alimento'))
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[10]['selection-b'];
  }
  if (
    combined.includes('arachne') ||
    combined.includes('athena') ||
    combined.includes('weaving contest')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[10]['selection-c'];
  }
  if (
    combined.includes('transforming philippine agriculture') ||
    combined.includes('philippine agriculture') ||
    combined.includes('da.gov.ph') ||
    combined.includes('cherrilyn')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[10]['selection-d'];
  }

  // Grade 7 selections
  if (
    combined.includes('what little things') ||
    combined.includes('madison julius cawein') ||
    combined.includes('cawein')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[7]['selection-a'];
  }
  if (
    combined.includes('plant intelligence') ||
    combined.includes('venus fly-trap') ||
    combined.includes('fly-trap') ||
    combined.includes('lyra b. bedis')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[7]['selection-b'];
  }
  if (
    combined.includes('pagasa') ||
    combined.includes('rainfall warning') ||
    combined.includes('color-coded rainfall')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[7]['selection-c'];
  }
  if (
    combined.includes('solid waste') ||
    combined.includes('denr-emb') ||
    combined.includes('waste management')
  ) {
    return PHIL_IRI_REFERENCES_BY_GRADE[7]['selection-d'];
  }

  // Check Filipino selections
  if (combined.includes('isandaang piso') || combined.includes('itay') || combined.includes('rona')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7]['selection-a'];
  }
  if (combined.includes('gen z at millennials') || combined.includes('kulturang pilipino') || combined.includes('mosqueza')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7]['selection-b'];
  }
  if (combined.includes('fiesta filipinas') || combined.includes('tanghalang metropolitan')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7]['selection-c'];
  }
  if (combined.includes('wikang filipino') || combined.includes('dela vega')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7]['selection-d'];
  }
  if (combined.includes('pistang bol-anon') || combined.includes('bol-anon')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[8]['selection-b'];
  }
  if (combined.includes('casa san miguel') || combined.includes('bolipata')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[8]['selection-c'];
  }
  if ((combined.includes('pneumonia') && combined.includes('doh')) || combined.includes('michelle m. medina')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[8]['selection-d'];
  }
  if (combined.includes('foul') && !combined.includes('deforestation')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[8]['selection-a'];
  }
  if (combined.includes('estudyante') || combined.includes('es-tud-yan-te')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[9]['selection-a'];
  }
  if (combined.includes('echoserang palaka')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[9]['selection-b'];
  }
  if (combined.includes('ink-clusive') || combined.includes('inclusive education')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[9]['selection-c'];
  }
  if (combined.includes('emergency supply kit') || combined.includes('kalamidad')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[9]['selection-d'];
  }
  if (combined.includes('abal-abal') || combined.includes('salagubang')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[10]['selection-a'];
  }
  if (combined.includes('direksiyon ng paglikas') || combined.includes('evacuation site')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[10]['selection-b'];
  }
  if (combined.includes('di ako maglalabas') || combined.includes('dario')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[10]['selection-c'];
  }
  if (combined.includes('big c') || combined.includes('kanser')) {
    return PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[10]['selection-d'];
  }

  // Fallback to partIdx if it's Phil-IRI
  if (options?.isPhilIri && options.partIdx !== undefined) {
    const isFil = (options as any)?.subject === 'Filipino';
    const targetSource = isFil ? (PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[g] || PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7]) : gradeRefs;
    if (options.partIdx === 0) return targetSource['selection-a'];
    if (options.partIdx === 1) return targetSource['selection-b'];
    if (options.partIdx === 2) return targetSource['selection-c'];
    if (options.partIdx === 3) return targetSource['selection-d'];
  }

  let refType: 'poem' | 'article' | 'advisory' | 'infographic' = 'article';
  if (/poem|stanza|verse|rhyme|poetry/i.test(combined)) {
    refType = 'poem';
  } else if (/advisory|warning|bulletin|alert|guideline/i.test(combined)) {
    refType = 'advisory';
  } else if (/infographic|chart|diagram|figure|visual/i.test(combined)) {
    refType = 'infographic';
  }

  return {
    passageTitle: title,
    referenceType: refType,
    passageText: text,
    passageImage: refType === 'infographic' ? (gradeRefs['selection-d']?.passageImage || '/uploads/materials/infographics/solid_waste_management.png') : undefined,
  };
}

export function buildPhilIriSections(gradeLevel: number = 7): QuestionnaireSection[] {
  const g = gradeLevel >= 7 && gradeLevel <= 10 ? gradeLevel : 7;
  const gradeRefs = PHIL_IRI_REFERENCES_BY_GRADE[g] || PHIL_IRI_REFERENCES_BY_GRADE[7];
  const partsMeta = [
    { ref: gradeRefs['selection-a'], start: 1, end: 10, part: 'I' },
    { ref: gradeRefs['selection-b'], start: 11, end: 20, part: 'II' },
    { ref: gradeRefs['selection-c'], start: 21, end: 30, part: 'III' },
    { ref: gradeRefs['selection-d'], start: 31, end: 40, part: 'IV' },
  ];

  return partsMeta.map(({ ref, start, end, part }) => ({
    partNumber: part,
    title: `PART ${part}: ${ref.passageTitle.toUpperCase()} (Items ${start}–${end})`,
    topic: ref.passageTitle,
    itemRange: `Items ${start}–${end}`,
    startItem: start,
    endItem: end,
    itemCount: 10,
    instructions: `Directions: Read the selection "${ref.passageTitle}" carefully. Choose the letter of the correct answer and shade the corresponding circle on your answer sheet.`,
    passageTitle: ref.passageTitle,
    passageText: ref.passageText,
    passageImage: ref.passageImage,
    referenceType: ref.referenceType,
  }));
}

export const PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE: Record<number, Record<string, ReferenceMaterial>> = {
  7: {
    'selection-a': {
      passageTitle: 'Isandaang Piso',
      referenceType: 'article',
      author: 'Rona / Kuwento',
      passageText: `Isandaang Piso

Alas-sais na ng umaga nang makauwi si Rona galing trabaho. Nakita niya ang kaniyang ama na nakaupo sa hapag-kainan. Sa mga oras na iyon ay alam niyang wala ang kaniyang ina dahil tuwing Biyernes ito namamalengke. Umupo na rin siya upang kumain bago magpahinga.

"Anak, kumusta ang trabaho mo?" tanong ng ama.

"Mabuti naman po, Itay," maikling tugon ni Rona habang sumusubo.

"Maaari ba akong humingi ng pabor, anak? Kung puwede sana ay mahiraman kita ng isandaang piso," may pag-aatubiling sabi ng ama.

Natigilan si Rona. Napabuntong-hininga siya. "Itay, kagagaling ko lang po sa trabaho at puyat ako. Saan niyo po ba gagamitin ang isandaang piso?"

Tumingin sa malayo ang ama bago sumagot nang mahinahon: "Nais ko sanang bumili ng isang oras ng iyong panahon upang makasabay kitang kumain at makausap nang mas matagal bago ka matulog."`,
    },
    'selection-b': {
      passageTitle: 'Gen Z at Millennials vs. Kulturang Pilipino',
      referenceType: 'article',
      author: 'Jun A. Mosqueza',
      passageText: `Gen Z at Millennials vs. Kulturang Pilipino
(Sinulat ni: Jun A. Mosqueza)

Nabubuhay tayo ngayon sa tinatawag na "Information Age". Tila titigil na sa pag-ikot ang mundo kung mawawala ang internet lalo na sa bagong henerasyon na kung tawagin ay Gen Z at Millennials. Parehong tech-savvy ang dalawang henerasyong ito. Mabilis silang makasabay sa takbo ng makabagong teknolohiya at mabilis ding makakuha ng impormasyon gamit ang mga gadyet.

Subalit, kasabay ng mabilis na modernisasyon ay ang pangambang unti-unting malimutan ang kulturang Pilipino. Ang dating pagmamano, paggamit ng "po" at "opo", pakikipagkapwa-tao, at pagpapahalaga sa pamilya ay napapalitan ng mga bagong gawi mula sa social media. Gayunpaman, may pag-asa pang mapagyaman ang kulturang Pilipino sa pamamagitan ng kanilang pagsisigasig na madagdagan ang kaalaman ukol dito gamit ang digital platforms.`,
    },
    'selection-c': {
      passageTitle: 'Fiesta Filipinas: Ang Kulay at Musika ng Pista sa Pilipinas',
      referenceType: 'article',
      author: 'Pagsusuri ng Palabas',
      passageText: `Fiesta Filipinas: Ang Kulay at Musika ng Pista sa Pilipinas
(Pagsusuri ng Palabas)

Hindi maipagkakailang nakahabi na sa kulturang Pilipino ang makulay na pagdiriwang ng mga pista sa lahat ng sulok ng bansa. Pinatunayan ito ng palabas na Fiesta Filipinas sa muling pagbubukas ng Tanghalang Metropolitan. Ipinamalas sa naturang pagtatanghal ang mayamang tradisyon, tugtugin, at kasuotan ng iba't ibang rehiyon sa Pilipinas.

Mula sa Pahiyas ng Quezon hanggang sa Sinulog ng Cebu, binigyang-buhay ng mga mananayaw at musikero ang diwa ng pagpapasalamat, pagkakaisa, at pananampalataya. Ang bawat indayog at ritmo ay nagpapaalala sa mga manonood na ang pista ay hindi lamang kasiyahan, kundi isang banal na paggunita sa kasaysayan at pagkakakilanlan ng bawat Pilipino.`,
    },
    'selection-d': {
      passageTitle: 'Mga Dapat Mong Malaman Tungkol sa Wikang Filipino',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/wikang_filipino.png',
      author: 'Layout ni Robby V. Dela Vega',
      passageText: `Infographic: Mga Dapat Mong Malaman Tungkol sa Wikang Filipino
Layout ni Robby V. Dela Vega

1. Ang Wikang Filipino ay ang pambansang wika ng Pilipinas ayon sa Saligang Batas ng 1987 (Artikulo XIV, Seksiyon 6).
2. Itinadhana ito bilang opisyal na wika ng komunikasyon at pagtuturo.
3. Ito ay patuloy na umuunlad at pinapayaman salig sa umiiral na mga katutubong wika sa Pilipinas at iba pang mga wika.
4. Mahalaga ang paggamit ng Filipino sa pamamahala, edukasyon, kalakalan, at media upang mapagkaisa ang bansa.`,
    },
  },
  8: {
    'selection-a': {
      passageTitle: 'Foul',
      referenceType: 'article',
      author: 'Kuwento',
      passageText: `Foul

Tahimik niyang binaybay ang makitid na eskinita papunta sa basketball court ng barangay. Urong-sulong siya kung maglakad. Ilang dipa na lang ang kaniyang layo sa court, abot-tanaw na niya ang mga manonood na naghihintay sa laban. Ito na ang huling laro sa liga ng barangay.

Bilang point guard ng koponan, hawak niya ang direksyon ng bawat opensa. Subalit mabigat ang kaniyang dibdib dahil sa alok na salapi kapalit ng pagpapatalo sa laro. Alam niyang labag ito sa kaniyang konsensiya at pagkatao. Sa bawat dribol at pasa sa laro, pinili niyang maglaro nang tapat at buong puso para sa kaniyang barangay, sapagkat ang tunay na pagkatalo ay ang paggawa ng maruming foul sa sariling dignidad.`,
    },
    'selection-b': {
      passageTitle: 'Pistang Bol-anon',
      referenceType: 'article',
      author: 'Artikulo',
      passageText: `Pistang Bol-anon

Kilala ang probinsiya ng Bohol sa pagiging magarbo sa tuwing nagdadaraos ng pista. Masasalamin ito sa tagal at haba ng pagdiriwang na aabot ng ilang araw. Dagdag pang nagpapasaya ang pag-uwi ng mga kamag-anak mula sa iba't ibang bansa at lalawigan upang makisalo sa pamilya.

Sa buwan ng Mayo, halos araw-araw ay may pista sa iba't ibang bayan ng Bohol. Para sa mga debotong Bol-anon, hindi magiging kompleto ang pagdiriwang ng kapistahan kapag hindi ka nakapunta sa simbahan at naisagawa ang patunub o tradisyunal na pagpapahid at pagpapala ng imahen ng patron. Ang pista ay sagisag ng walang hanggang pasasalamat sa mga biyaya ng Maykapal.`,
    },
    'selection-c': {
      passageTitle: 'Casa San Miguel: Pugad ng mga Manlilikha',
      referenceType: 'article',
      author: 'Artikulo',
      passageText: `Casa San Miguel: Pugad ng mga Manlilikha

Maihahalintulad sa isang punong walang ugat ang isang bayang mangmang sa kaniyang nakalipas. Sapagkat ang nakaraan ang magtuturo ng daan ng kaniyang bukas. Sa bayan ng San Antonio sa Zambales matatagpuan ang Casa San Miguel, isang sentrong pangsining na itinatag ng tanyag na biyolinistang si Ramon Bolipata.

Dito, ang mga kabataang katutubo at lokal ay tinuturuang tumugtog ng klasikal na musika at lumikha ng mga obra sa sining. Sa gitna ng luntiang manggahan at malapit sa dalampasigan ng Dagat Kanlurang Pilipinas, ang Casa ay naging pugad ng pag-asa at inspirasyon, nagpapatunay na ang sining ay kayang magbago ng buhay at magbuklod ng isang komunidad.`,
    },
    'selection-d': {
      passageTitle: 'DOH Investigates Case of Pneumonia',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/doh_pneumonia.png',
      author: 'DOH / Michelle M. Medina',
      passageText: `Infographic: DOH Investigates Case of Pneumonia
(Hango mula sa Kagawaran ng Kalusugan - DOH)

1. Patuloy na minomonitor ng Department of Health (DOH) ang mga kaso ng malubhang respiratory illness at pneumonia sa bansa.
2. Mahalaga ang agarang pagpapakonsulta sa pinakamalapit na health center kapag may nararanasang lagnat, ubo, hirap sa paghinga, at paninikip ng dibdib.
3. Paalala sa publiko: Maghugas ng kamay gamit ang sabon at tubig, magsuot ng mask sa matataong lugar, at panatilihin ang malinis na kapaligiran upang maiwasan ang hawaan.`,
    },
  },
  9: {
    'selection-a': {
      passageTitle: 'ES-TUD-YAN-TE',
      referenceType: 'article',
      author: 'Dagli',
      passageText: `ES-TUD-YAN-TE
(Dagli)

Butil-butil na ang kaniyang pawis, nanlalamig ang buong katawan. Paulit-ulit niyang ipinapahid ang mga namamasang palad sa kaniyang damit. Pakiramdam niya, isang oras na siyang nakaupo sa tapat ng silid ng prinsipal habang hawak ang kaniyang report card.

Tinitigan niya ang bawat marka. Sa ilalim ng kaniyang pangalan, may tatlong bituin na iginuhit ng kaniyang nakababatang kapatid bago siya umalis ng bahay. "Para po suwertehin ka, Kuya," sabi nito. Napangiti siya sa gitna ng kaba. Naalala niya ang sakripisyo ng kaniyang mga magulang para lamang makapagtapos siya. Tumayo siya nang tuwid nang marinig ang pagtawag sa kaniyang pangalan.`,
    },
    'selection-b': {
      passageTitle: 'Echoserang Palaka!',
      referenceType: 'poem',
      author: 'Tula',
      passageText: `Echoserang Palaka!
(Tula)

Sino nga ba itong si "Echoserang Palaka?"
Na sa twina'y nakatitig at nakikinig;
'Di marunong tumawa at napakamahal ng saya;
Akalain mong tila ginagaya si Monalisa.

Sa umaga hanggang gabi'y walang ibang gawa,
Kundi punahin ang mali ng kapwa;
Bawat kilos mo'y may puna at kumento,
Wala raw sa ayos ang iyong postura at baro.

Ngunit kapag sariling gawa na ang tinimbang,
Lahat ng kapintasan ay pilit tinatakpan;
O Echoserang Palaka, magbago ka na sana,
Bago ka maiwan ng panahon at mawalan ng kasama.`,
    },
    'selection-c': {
      passageTitle: 'Ink-clusive: Karapatan sa Karunungan ng May Kapansanan',
      referenceType: 'article',
      author: 'Artikulo',
      passageText: `Ink-clusive: Karapatan sa Karunungan ng May Kapansanan

Isang malaking pagsubok para sa bawat batang may kapansanan ang pagtanggap sa kaniya ng lipunan lalo na sa paaralan. Pinukaw ng usaping ito ang pangangailangan para sa Inclusive Education Act sa Pilipinas upang bigyan ng pantay na karapatan ang lahat ng mag-aaral anuman ang kanilang kalagayan.

Sa ilalim ng batas, obligado ang bawat institusyon na maglaan ng angkop na kagamitan, espesyal na pasilidad, at mga gurong may sapat na pagsasanay. Ang edukasyon ay hindi pribilehiyo ng iilan kundi pangunahing karapatan ng bawat mamamayan na dapat tamasahin nang walang diskriminasyon.`,
    },
    'selection-d': {
      passageTitle: 'Maghanda ng Emergency Supply Kit',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/emergency_supply_kit.png',
      author: 'Paghahanda sa Kalamidad',
      passageText: `Infographic: Maghanda ng Emergency Supply Kit
(Paghahanda sa Kalamidad)

1. Maghanda ng supply kit na tatagal ng hindi bababa sa 72 oras (3 araw).
2. Tubig: Isang galon bawat tao kada araw para sa inumin at kalinisan.
3. Pagkain: Ready-to-eat canned goods at energy bars na hindi madaling mapanis.
4. First Aid Kit: Mga karaniwang gamot, bendahe, alcohol, at personal prescription medications.
5. Kagamitan: Flashlight, pito (whistle), baterya, radyo, posporo, at mahahalagang dokumento sa waterproof pouch.`,
    },
  },
  10: {
    'selection-a': {
      passageTitle: 'Abal-abal',
      referenceType: 'article',
      author: 'Sanaysay / Artikulo',
      passageText: `Abal-abal

Pagsapit ng dapit-hapon, naghahanda na kami para manghuli ng Abal-abal o salagubang. Dala-dala ang flashlight, galon ng mineral water o lalagyan ng tubig. Magsisilabasan kasi ang mga ito sa mga puno ng mangga, bayabas, at santol sa pagsapit ng dilim.

Likas sa mga Pilipino sa lalawigan ang pagiging maparaan upang mabuhay. Ang abal-abal ay hindi lamang simpleng insekto para sa amin kundi isang masustansya at masarap na putahe kapag iginisa sa bawang, sibuyas, at suka. Sa simpleng gawaing ito ay napagbubuklod ang pamilya at natututuhan ang pagpapahalaga sa kalikasan.`,
    },
    'selection-b': {
      passageTitle: 'Mapa at Direksiyon ng Paglikas',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/mapa_ng_paglikas.png',
      author: 'Dayagram / Lungsod Maharlika',
      passageText: `Infographic: Mapa at Direksiyon ng Paglikas
Tungo sa Evacuation Site sa Panahon ng Sakuna sa Lungsod Maharlika

1. Alamin ang iyong pupuntahan sa oras ng sakuna: Sundin ang mga berdeng palatandaan at arrows papunta sa designated evacuation center sa covered court at paaralan.
2. Iwasan ang mga rutang malapit sa tabing-ilog at mabababang lugar na madaling bahain o gumuho.
3. Dalhin ang Go-Bag at unahin ang kaligtasan ng mga bata, matatanda, at may kapansanan.`,
    },
    'selection-c': {
      passageTitle: "'Di Ako Maglalabas",
      referenceType: 'article',
      author: 'Dagli / Kuwento',
      passageText: `'Di Ako Maglalabas!
(Dagli)

"'Di ako maglalabas!"
Panay ang hampas ni Dario sa manibela ng sinasakyang mamahaling kotse habang sinusuyod ang mga dating buhay na buhay na pamilihan bago magpandemya. Palinga-linga siya sa paligid habang naghahanap ng bukas na botika at grocery.

Nang makakita ng maliit na sari-sari store, nagmamadali siyang bumaba upang bumili ng noodles, de lata, at gamot para sa kaniyang pamilya. Isang binatang nagbukas ng tindahan ang sumalubong sa kaniya nang may ngiti. Sa kabila ng takot at pag-iingat, napagtanto ni Dario na sa panahon ng kagipitan, ang pagtutulungan at malasakit sa kapwa ang tanging magliligtas sa ating lahat.`,
    },
    'selection-d': {
      passageTitle: 'Big C, Noon at Ngayon',
      referenceType: 'infographic',
      passageImage: '/uploads/materials/infographics/big_c_noon_at_ngayon.png',
      author: 'Medisina / Kaalaman sa Kanser',
      passageText: `Infographic: Big C, Noon at Ngayon
(Kaalaman Laban sa Kanser)

1. Noon, ang kanser (Big C) ay itinuturing na hatol ng kamatayan nang walang lunas.
2. Ngayon, dahil sa pagsulong ng medisina tulad ng Immunotherapy at CAR-T cell therapy, mas mataas na ang tsansa ng paggaling lalo na kapag maagang natukoy (early detection).
3. Panatilihin ang malusog na pamumuhay: Mag-ehersisyo, kumain ng gulay at prutas, umiwas sa paninigarilyo at labis na alak, at magpa-checkup nang regular.`,
    },
  },
};

export function buildPhilIriFilipinoSections(gradeLevel: number = 7): QuestionnaireSection[] {
  const g = gradeLevel >= 7 && gradeLevel <= 10 ? gradeLevel : 7;
  const gradeRefs = PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[g] || PHIL_IRI_FILIPINO_REFERENCES_BY_GRADE[7];
  const partsMeta = [
    { ref: gradeRefs['selection-a'], start: 1, end: 10, part: 'I', label: 'BAHAGI I' },
    { ref: gradeRefs['selection-b'], start: 11, end: 20, part: 'II', label: 'BAHAGI II' },
    { ref: gradeRefs['selection-c'], start: 21, end: 30, part: 'III', label: 'BAHAGI III' },
    { ref: gradeRefs['selection-d'], start: 31, end: 40, part: 'IV', label: 'BAHAGI IV' },
  ];

  return partsMeta.map(({ ref, start, end, part, label }) => ({
    partNumber: part,
    title: `${label}: ${ref.passageTitle.toUpperCase()} (Mga Bilang ${start}–${end})`,
    topic: ref.passageTitle,
    itemRange: `Mga Bilang ${start}–${end}`,
    startItem: start,
    endItem: end,
    itemCount: 10,
    instructions: `Panuto: Basahing mabuti ang seleksiyong "${ref.passageTitle}". Piliin ang titik ng tamang sagot at itiman ang kaukulang bilog sa iyong sagutang papel.`,
    passageTitle: ref.passageTitle,
    passageText: ref.passageText,
    passageImage: ref.passageImage,
    referenceType: ref.referenceType,
  }));
}

export function buildPhilIriG7Sections(): QuestionnaireSection[] {
  return buildPhilIriSections(7);
}

export function buildPhilIriG8Sections(): QuestionnaireSection[] {
  return buildPhilIriSections(8);
}

export function buildPhilIriG9Sections(): QuestionnaireSection[] {
  return buildPhilIriSections(9);
}

export function buildPhilIriG10Sections(): QuestionnaireSection[] {
  return buildPhilIriSections(10);
}
