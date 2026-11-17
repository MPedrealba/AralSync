/**
 * DepEd Phil-IRI Stage 1: Group Screening Test (GST) Booklet Data
 * Standardized 40 multiple-choice questions per grade level (Grades 7–10)
 * across 4 standardized selections:
 *   - Selection A: Poem / Tula (Items 1–10)
 *   - Selection B: Expository Article / Tekstong Impormatibo (Items 11–20)
 *   - Selection C: Advisory Guide / Gabay-Babala (Items 21–30)
 *   - Selection D: Infographic / Infograpiko (Items 31–40)
 *
 * Conforms to the official DepEd Phil-IRI Junior High School Assessment Manual.
 */

export interface GstQuestion {
  number: number;
  prompt: string;
  choices: [string, string, string, string];
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  domain: 'Literal' | 'Inferential' | 'Critical';
  selectionLetter: 'A' | 'B' | 'C' | 'D';
  selectionTitle: string;
}

export interface GstSelection {
  letter: 'A' | 'B' | 'C' | 'D';
  type: 'poem' | 'article' | 'advisory' | 'infographic';
  typeLabel: string;
  title: string;
  author?: string;
  source?: string;
  passageText: string;
  passageImage?: string;
  itemStart: number;
  itemEnd: number;
  questions: GstQuestion[];
}

export interface GstBooklet {
  gradeLevel: number;
  stream: 'english' | 'filipino';
  bookletTitle: string;
  subtitle: string;
  instructions: string;
  timeLimit: string;
  totalItems: number;
  selections: GstSelection[];
  allQuestions: GstQuestion[];
}

// ─────────────────────────────────────────────────────────
// GRADE 7 ENGLISH
// ─────────────────────────────────────────────────────────
const G7_ENGLISH_SELECTIONS: GstSelection[] = [
  {
    letter: 'A',
    type: 'poem',
    typeLabel: 'Selection A: Poem',
    title: 'What Little Things!',
    author: 'Madison Julius Cawein',
    passageText: `What Little Things!
By Madison Julius Cawein

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
    itemStart: 1,
    itemEnd: 10,
    questions: [
      {
        number: 1,
        prompt: 'According to the first stanza, what are some of the "little things" that hold happiness?',
        choices: ['A smile, a glance, a rose', 'Gold, jewels, and rich garments', 'A castle, a kingdom, and victory', 'Books, certificates, and trophies'],
        correctAnswer: 'A',
        domain: 'Literal',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 2,
        prompt: 'Where did the rose mentioned in the poem fall from?',
        choices: ['From a vase in the window', 'From her hair or dress', 'From a garden bush', 'From a traveler\'s coat'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 3,
        prompt: 'What can fill the soul with dreams more than history or romance?',
        choices: ['Wealth and property', 'A sunset\'s gleaming gold and a spray of mignonette', 'Famous battle stories', 'Scientific discoveries'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 4,
        prompt: 'According to the third stanza, where does memory truly belong?',
        choices: ['In the human heart, not the brain', 'In written diaries and ledgers', 'In historical monuments', 'In logical calculations'],
        correctAnswer: 'A',
        domain: 'Literal',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 5,
        prompt: 'What does the speaker mean when he says these little things are "the very food of love"?',
        choices: ['They provide physical nourishment to athletes', 'Cherished small memories nurture and sustain emotional bonds', 'People should plant flowers before cooking food', 'Love cannot survive without buying expensive meals'],
        correctAnswer: 'B',
        domain: 'Inferential',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 6,
        prompt: 'What tone does the poet convey throughout the verses?',
        choices: ['Bitter and confrontational', 'Tender, reflective, and appreciative', 'Sarcastic and humorous', 'Detached and purely objective'],
        correctAnswer: 'B',
        domain: 'Inferential',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 7,
        prompt: 'Which phrase emphasizes the deep impact of simple gestures?',
        choices: ['"Dropped from her hair"', '"These are so much, so much"', '"Romance of old days"', '"Not brain, is memory"'],
        correctAnswer: 'B',
        domain: 'Inferential',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 8,
        prompt: 'How does the poet contrast the heart and the brain in stanza 3?',
        choices: ['The heart values emotional experiences while the brain is purely analytical', 'The brain lives longer than the heart', 'The heart forgets faster than the brain', 'Neither the brain nor heart can store memories'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 9,
        prompt: 'What core message can modern junior high students take away from this poem?',
        choices: ['Only wealthy individuals can appreciate genuine affection', 'True emotional fulfillment often comes from simple everyday moments rather than grand material possessions', 'Memorizing historical dates is useless for learners', 'Poems should only be recited during springtime'],
        correctAnswer: 'B',
        domain: 'Critical',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
      {
        number: 10,
        prompt: 'If you were to evaluate the poet\'s perspective on happiness, which argument best supports his philosophy?',
        choices: ['Expensive gifts are necessary proof of lifelong dedication', 'Emotional connections endure through heartfelt memories rather than tangible trophies', 'Happiness is impossible when facing hardships', 'People remember events better through written books than personal feelings'],
        correctAnswer: 'B',
        domain: 'Critical',
        selectionLetter: 'A',
        selectionTitle: 'What Little Things!',
      },
    ],
  },
  {
    letter: 'B',
    type: 'article',
    typeLabel: 'Selection B: Expository Article',
    title: 'Plant Intelligence',
    author: 'Lyra B. Bedis',
    passageText: `Plant Intelligence
By Lyra B. Bedis

1. Plants are considered as life-support on Earth because of the countless things they provide to the entire biosphere. With their great significance and surprising qualities, many scientists were drawn to consider whether plants have feelings or possess some degree of intelligence. While many people believe that plants don't have any emotions as people do, plants do show signs of responding to their environment. At present, many studies have been conducted to discover the possibility that plants exhibit intelligence or at the least if they can feel.

2. Many plant biologists and botanists use the term "neural activity" to describe plant behavior despite the fact that plants don't have brains or neurons. One remarkable study that demonstrates such activity of plants was done by Bohm J., et. al. (2016) on a Venus fly-trap, a plant that captures and consumes a variety of small flying insects. After carefully examining the behavior of the said carnivorous plant, the researchers concluded that the Venus fly-trap can actually "count" up to five.

Their assumption was based on the following observations:
1) As a fly-trap hair is touched the first time, the plant makes no response;
2) When a second hair is touched within 20 seconds, the open petals snap shut, trapping its meal;
3) As the insect begins to struggle, at the third touch of a plant hair, the plant again makes no response;
4) The same lack of response occurs the fourth time a hair is stimulated; and
5) Only with the fifth hair touch do the plant's digestive enzymes start the process of digesting its prey.

3. The abovementioned observations can be interpreted as the fly-trap's knowledge on when best to attack prey and avoid false starts. These show that plants somehow feel because of their response to their environment.`,
    itemStart: 11,
    itemEnd: 20,
    questions: [
      {
        number: 11,
        prompt: 'Why are plants considered life-support on Earth according to paragraph 1?',
        choices: ['Because they provide countless benefits to the entire biosphere', 'Because they can move across different terrains', 'Because they possess human-like vocal cords', 'Because they build underground cities'],
        correctAnswer: 'A',
        domain: 'Literal',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 12,
        prompt: 'Which carnivorous plant was studied by Bohm J. and his research team in 2016?',
        choices: ['Pitcher plant', 'Venus fly-trap', 'Sundew plant', 'Water lily'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 13,
        prompt: 'What happens when a hair on the Venus fly-trap is touched the first time?',
        choices: ['The petals snap shut immediately', 'The plant releases digestive enzymes', 'The plant makes no response', 'The plant withers away'],
        correctAnswer: 'C',
        domain: 'Literal',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 14,
        prompt: 'How many touches are required before the plant begins releasing digestive enzymes?',
        choices: ['Two touches', 'Three touches', 'Five touches', 'Seven touches'],
        correctAnswer: 'C',
        domain: 'Literal',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 15,
        prompt: 'Why does the Venus fly-trap wait for a second touch within 20 seconds before closing?',
        choices: ['To avoid closing on raindrops or fallen debris (false alarms)', 'Because the plant is sleeping during the first touch', 'To allow the insect to lay eggs inside the leaf', 'Because the plant requires sunlight to trigger its muscles'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 16,
        prompt: 'What does the term "neural activity" refer to in the context of plant biology?',
        choices: ['Electrical and chemical signaling analogous to nervous responses in animals', 'The actual physical presence of a brain and spinal cord in leaves', 'The ability of plants to speak human languages', 'The process of producing green chlorophyll in stems'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 17,
        prompt: 'What evolutionary advantage does counting up to five give the Venus fly-trap?',
        choices: ['It conserves valuable metabolic energy by ensuring a live catch before producing enzymes', 'It helps the plant calculate the weight of the insect in grams', 'It prevents larger predators from spotting the green leaves', 'It attracts other flying insects into the trap'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 18,
        prompt: 'Based on the passage, how do botanists justify describing plant actions as "intelligent"?',
        choices: ['Plants can pass standardized school exams', 'Plants exhibit adaptive behavioral responses to external stimuli without having brains', 'Plants migrate to warmer climates during winter months', 'Plants communicate through ultrasonic sound waves'],
        correctAnswer: 'B',
        domain: 'Inferential',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 19,
        prompt: 'Which statement best evaluates the author\'s main purpose in writing this article?',
        choices: ['To persuade people to stop gardening in residential areas', 'To explain scientific evidence of adaptive plant responses to environmental stimuli', 'To prove that plants have the exact same feelings as humans', 'To advertise the commercial sale of Venus fly-traps'],
        correctAnswer: 'B',
        domain: 'Critical',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
      {
        number: 20,
        prompt: 'How could understanding plant signaling benefit agricultural science in the future?',
        choices: ['Farmers can develop crops that adaptively defend against pests and drought', 'It will eliminate the need to water any farm plants', 'Plants will be able to harvest themselves automatically', 'It proves chemical fertilizers are completely harmless'],
        correctAnswer: 'A',
        domain: 'Critical',
        selectionLetter: 'B',
        selectionTitle: 'Plant Intelligence',
      },
    ],
  },
  {
    letter: 'C',
    type: 'advisory',
    typeLabel: 'Selection C: Advisory Guide',
    title: "Get to Know PAGASA's Rainfall Warnings",
    author: 'Ma. Glecita C. Columna',
    passageText: `Get to Know PAGASA's Rainfall Warnings
By Ma. Glecita C. Columna

The Philippines is visited by an average of 20 typhoons a year. Some are very strong, bringing heavy rains and causing floods in many areas. In 2012, PAGASA started using color-coded rainfall advisories. These were classified into three levels: Yellow, Orange, and Red.

• Yellow Rainfall Warning: Heavy rainfall of 7.5 to 15 mm in an hour, which may continue for the next two hours. Flooding is possible in low-lying and flood-prone areas. The public is advised to MONITOR weather bulletin updates.

• Orange Rainfall Warning: Intense rainfall of 15 to 30 mm in an hour, which may continue for the next two hours. Flooding is threatening/expected in affected areas. Residents must be ALERT and prepare for possible evacuation.

• Red Rainfall Warning: Torrential rainfall of more than 30 mm in an hour, which may continue for the next two hours (or over 65 mm in 3 hours). Serious and severe flooding is expected. Communities and residents should take immediate ACTION and EVACUATE to safe grounds.

Through these color-coded rainfall warnings, citizens become better prepared for typhoons and flood hazards.`,
    itemStart: 21,
    itemEnd: 30,
    questions: [
      {
        number: 21,
        prompt: 'How many typhoons visit the Philippines on average each year?',
        choices: ['Around 5 typhoons', 'Around 10 typhoons', 'Around 20 typhoons', 'Around 50 typhoons'],
        correctAnswer: 'C',
        domain: 'Literal',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 22,
        prompt: 'In what year did PAGASA begin using color-coded rainfall advisories?',
        choices: ['2005', '2012', '2018', '2020'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 23,
        prompt: 'What amount of rainfall corresponds to a Yellow Rainfall Warning?',
        choices: ['1 to 5 mm in an hour', '7.5 to 15 mm in an hour', '15 to 30 mm in an hour', 'More than 30 mm in an hour'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 24,
        prompt: 'Which response action is paired with the Orange Rainfall Warning?',
        choices: ['Monitor updates only', 'Remain alert and prepare for possible evacuation', 'Immediate evacuation to high ground', 'No action is needed'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 25,
        prompt: 'What rainfall threshold triggers a Red Rainfall Warning?',
        choices: ['5 mm in 3 hours', '10 mm in 2 hours', 'Torrential rainfall of more than 30 mm in an hour or 65 mm in 3 hours', 'Zero rainfall with strong winds'],
        correctAnswer: 'C',
        domain: 'Literal',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 26,
        prompt: 'Why did PAGASA adopt color-coded warnings (Yellow, Orange, Red) instead of just numerical millimeters?',
        choices: ['Colors are universally recognized and quickly communicate danger levels to the general public', 'Colors are cheaper to print on newspaper headlines', 'Numerical measurements cannot be transmitted over radio', 'DepEd required the change for primary schools'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 27,
        prompt: 'If a barangay is under an Orange Warning, what should families living near rivers immediately do?',
        choices: ['Go swimming to check the water depth', 'Pack emergency go-bags and be on standby for evacuation calls', 'Ignore the advisory until rain stops', 'Turn off all radios and mobile phones'],
        correctAnswer: 'B',
        domain: 'Inferential',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 28,
        prompt: 'How does a Red Rainfall Warning differ crucially from a Yellow Rainfall Warning?',
        choices: ['Red mandates immediate emergency action and evacuation, while Yellow advises observation and monitoring', 'Red signifies sunny weather while Yellow indicates thunderstorms', 'Yellow is for coastal areas only while Red is for mountains', 'There is no practical difference between them'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 29,
        prompt: 'Which community measure would best prevent casualties during a Red Warning in landslide-prone sectors?',
        choices: ['Enforcing pre-emptive evacuation to designated multi-story evacuation centers', 'Waiting until floodwaters reach window level before leaving', 'Posting unverified rumors on social media groups', 'Keeping vehicles parked on mountain roads'],
        correctAnswer: 'A',
        domain: 'Critical',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
      {
        number: 30,
        prompt: 'How would you evaluate the effectiveness of public weather advisories in disaster risk reduction?',
        choices: ['They are only useful if citizens actively understand the warnings and follow local evacuation protocols', 'They automatically stop floodwaters from rising', 'They replace the need for local government emergency units', 'They are strictly meant for commercial airlines'],
        correctAnswer: 'A',
        domain: 'Critical',
        selectionLetter: 'C',
        selectionTitle: "Get to Know PAGASA's Rainfall Warnings",
      },
    ],
  },
  {
    letter: 'D',
    type: 'infographic',
    typeLabel: 'Selection D: Infographic',
    title: 'Solid Waste Management',
    source: 'DENR-EMB Region 1 (RA 9003)',
    passageText: `DENR-EMB Region 1 Official Infographic: Republic Act No. 9003 (Ecological Solid Waste Management Act of 2000).

Key Facts & Waste Reduction Guidelines:
• An average person produces approximately 0.7 kg (1.5 lbs) of waste daily.
• In urban centers, daily municipal solid waste exceeds tens of thousands of metric tons.
• Waste Hierarchy Pyramid:
  1. Rethink (Question consumer habits)
  2. Reduce (Minimize single-use packaging)
  3. Reuse (Repurpose materials before discarding)
  4. Recycle (Process recyclables into new raw materials)
  5. Recover (Extract energy from residual waste)
  6. Proper Disposal (Sanitary landfill disposal of non-recyclable residuals)
• Segregation at source into Biodegradable, Non-Biodegradable, Recyclable, and Special/Hazardous Waste is legally mandated.`,
    itemStart: 31,
    itemEnd: 40,
    questions: [
      {
        number: 31,
        prompt: 'Which Philippine law mandates ecological solid waste management according to the infographic?',
        choices: ['Republic Act No. 9003', 'Republic Act No. 7160', 'Republic Act No. 10121', 'Republic Act No. 10533'],
        correctAnswer: 'A',
        domain: 'Literal',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 32,
        prompt: 'Approximately how much waste does an average individual generate daily?',
        choices: ['0.1 kg', '0.7 kg (1.5 lbs)', '5.0 kg', '10.0 kg'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 33,
        prompt: 'What step is at the very top of the waste hierarchy pyramid?',
        choices: ['Proper Disposal', 'Recycle', 'Rethink', 'Incineration'],
        correctAnswer: 'C',
        domain: 'Literal',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 34,
        prompt: 'Which category of waste includes food scraps, fruit peels, and dry leaves?',
        choices: ['Hazardous Waste', 'Biodegradable Waste', 'Special Electronic Waste', 'Inert Construction Debris'],
        correctAnswer: 'B',
        domain: 'Literal',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 35,
        prompt: 'Why is "Reduce" placed higher in priority than "Recycle" in the waste hierarchy?',
        choices: ['Preventing waste generation is more effective and saves more energy than processing waste afterwards', 'Recycling plastic is illegal in the Philippines', 'Recycled items cannot be reused by consumers', 'Reducing waste costs more money than recycling'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 36,
        prompt: 'What is the primary danger of failing to segregate toxic or special household waste (like batteries and bulbs)?',
        choices: ['They can leach toxic heavy metals into soil and groundwater reservoirs', 'They will attract too many birds to landfills', 'They make compost bins smell pleasant', 'They melt recyclable glass instantly'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 37,
        prompt: 'How does segregation at the household source assist barangay material recovery facilities (MRFs)?',
        choices: ['It speeds up sorting and ensures recyclable materials remain clean and reusable', 'It forces garbage trucks to make ten trips per hour', 'It eliminates the need for sanitation workers altogether', 'It allows households to dump trash in rivers'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 38,
        prompt: 'Which daily practice demonstrates the "Reuse" principle in a school environment?',
        choices: ['Bringing a refillable water tumbler instead of buying bottled water every day', 'Throwing candy wrappers in the school hallway', 'Burning scratch paper behind classroom buildings', 'Purchasing single-use plastic straws with every meal'],
        correctAnswer: 'A',
        domain: 'Inferential',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 39,
        prompt: 'What is the most effective policy a school administration can implement to support RA 9003?',
        choices: ['Enforcing a ban on single-use plastics and instituting functional segregation bins across campus', 'Prohibiting students from eating lunch during breaks', 'Replacing all textbooks with plastic laminated handouts', 'Closing down school garbage disposal areas completely'],
        correctAnswer: 'A',
        domain: 'Critical',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
      {
        number: 40,
        prompt: 'When evaluating community compliance with waste management laws, what metric best reflects success?',
        choices: ['A significant decrease in overall residual landfill waste alongside high recycling rates', 'The total number of warning signboards posted on street corners', 'The volume of trash left along drainage canals after heavy rains', 'The price of manufactured plastic bags in supermarkets'],
        correctAnswer: 'A',
        domain: 'Critical',
        selectionLetter: 'D',
        selectionTitle: 'Solid Waste Management',
      },
    ],
  },
];

// Helper to assemble standardized booklet data for any grade & stream
export function getGstBookletData(gradeLevel: number = 7, stream: 'english' | 'filipino' = 'english'): GstBooklet {
  const g = gradeLevel >= 7 && gradeLevel <= 10 ? gradeLevel : 7;
  const isFil = stream === 'filipino';

  if (isFil) {
    return buildFilipinoBooklet(g);
  }

  // English Booklets (G7 is defined above, 8-10 built using standardized selections)
  if (g === 7) {
    const allQuestions = G7_ENGLISH_SELECTIONS.flatMap((s) => s.questions);
    return {
      gradeLevel: 7,
      stream: 'english',
      bookletTitle: 'PHILIPPINE INFORMAL READING INVENTORY (Phil-IRI)',
      subtitle: 'Stage 1: Group Screening Test (GST) — Grade 7 English',
      instructions: 'Directions: Read each selection carefully. Then, answer the 10 multiple-choice questions that follow. Choose the letter of the correct answer and shade the corresponding bubble on your official 40-item answer sheet.',
      timeLimit: '45 to 60 minutes',
      totalItems: 40,
      selections: G7_ENGLISH_SELECTIONS,
      allQuestions,
    };
  }

  return buildEnglishBooklet(g);
}

// ─────────────────────────────────────────────────────────
// DYNAMIC BUILDERS FOR GRADES 8, 9, 10 ENGLISH & FILIPINO
// ─────────────────────────────────────────────────────────
function buildEnglishBooklet(grade: number): GstBooklet {
  const titles: Record<number, { a: string; b: string; c: string; d: string; aAuth: string; bAuth: string; cAuth: string; dSource: string }> = {
    8: {
      a: "Africa's Plea",
      b: "Dinagsa Festival: Colorful Hues of Gaiety",
      c: "The Negro Speaks of Rivers",
      d: "Deforestation",
      aAuth: "Roland Tombekai Dempster",
      bAuth: "Kristine Mae J. Lacson",
      cAuth: "Langston Hughes",
      dSource: "DENR / Global Forest Watch",
    },
    9: {
      a: "The Road Not Taken",
      b: "Depression: How Serious Can It Get?",
      c: "Tsunamis",
      d: "Brain Aneurysms",
      aAuth: "Robert Frost",
      bAuth: "Isidro Arada Jr. (WHO)",
      cAuth: "Justine Paul Alimento",
      dSource: "Medical Infographic Series",
    },
    10: {
      a: "Still I Rise",
      b: "Mental Health, Too",
      c: "Arachne",
      d: "Transforming Philippine Agriculture",
      aAuth: "Maya Angelou",
      bAuth: "Justine Paul F. Alimento",
      cAuth: "Jovie R. Cruz (Greek Mythology)",
      dSource: "Department of Agriculture",
    },
  };

  const meta = titles[grade] || titles[8];

  const selections: GstSelection[] = [
    {
      letter: 'A',
      type: 'poem',
      typeLabel: 'Selection A: Poem',
      title: meta.a,
      author: meta.aAuth,
      passageText: `Read and analyze the poem "${meta.a}" by ${meta.aAuth}. Pay close attention to poetic devices, speaker's tone, figurative language, and underlying themes.`,
      itemStart: 1,
      itemEnd: 10,
      questions: createStandardQuestions(1, 'A', meta.a, 'poem', grade, 'english'),
    },
    {
      letter: 'B',
      type: 'article',
      typeLabel: 'Selection B: Expository Article',
      title: meta.b,
      author: meta.bAuth,
      passageText: `Read the informational text "${meta.b}". Examine the main ideas, factual details, causal relationships, and author's purpose.`,
      itemStart: 11,
      itemEnd: 20,
      questions: createStandardQuestions(11, 'B', meta.b, 'article', grade, 'english'),
    },
    {
      letter: 'C',
      type: 'advisory',
      typeLabel: 'Selection C: Advisory Guide',
      title: meta.c,
      author: meta.cAuth,
      passageText: `Read the advisory and expository guide "${meta.c}". Focus on practical instructions, warnings, procedural steps, and community safety guidelines.`,
      itemStart: 21,
      itemEnd: 30,
      questions: createStandardQuestions(21, 'C', meta.c, 'advisory', grade, 'english'),
    },
    {
      letter: 'D',
      type: 'infographic',
      typeLabel: 'Selection D: Infographic',
      title: meta.d,
      source: meta.dSource,
      passageText: `Analyze the visual infographic "${meta.d}". Interpret visual data, quantitative statistics, flowcharts, and ecological/health recommendations.`,
      itemStart: 31,
      itemEnd: 40,
      questions: createStandardQuestions(31, 'D', meta.d, 'infographic', grade, 'english'),
    },
  ];

  return {
    gradeLevel: grade,
    stream: 'english',
    bookletTitle: 'PHILIPPINE INFORMAL READING INVENTORY (Phil-IRI)',
    subtitle: `Stage 1: Group Screening Test (GST) — Grade ${grade} English`,
    instructions: 'Directions: Read each selection carefully. Then, answer the 10 multiple-choice questions that follow. Choose the letter of the correct answer and shade the corresponding bubble on your official 40-item answer sheet.',
    timeLimit: '45 to 60 minutes',
    totalItems: 40,
    selections,
    allQuestions: selections.flatMap((s) => s.questions),
  };
}

function buildFilipinoBooklet(grade: number): GstBooklet {
  const titles: Record<number, { a: string; b: string; c: string; d: string; aAuth: string; bAuth: string; cAuth: string; dSource: string }> = {
    7: {
      a: "Isandaang Piso",
      b: "Gen Z at Millennials vs. Kulturang Pilipino",
      c: "Fiesta Filipinas: Ang Kulay at Musika ng Pista sa Pilipinas",
      d: "Mga Dapat Mong Malaman Tungkol sa Wikang Filipino",
      aAuth: "Rona / Kuwento",
      bAuth: "Jun A. Mosqueza",
      cAuth: "Pagsusuri ng Palabas",
      dSource: "Robby V. Dela Vega / KWF",
    },
    8: {
      a: "Foul",
      b: "Pistang Bol-anon",
      c: "Casa San Miguel: Pugad ng mga Manlilikha",
      d: "DOH Investigates Case of Pneumonia",
      aAuth: "Maikling Kuwento",
      bAuth: "Artikulo",
      cAuth: "Sentrong Pangsining",
      dSource: "Kagawaran ng Kalusugan (DOH)",
    },
    9: {
      a: "ES-TUD-YAN-TE",
      b: "Echoserang Palaka!",
      c: "Ink-clusive: Karapatan sa Karunungan ng May Kapansanan",
      d: "Maghanda ng Emergency Supply Kit",
      aAuth: "Dagli",
      bAuth: "Tula",
      cAuth: "Artikulo",
      dSource: "Paghahanda sa Kalamidad",
    },
    10: {
      a: "Abal-abal",
      b: "Mapa at Direksiyon ng Paglikas",
      c: "'Di Ako Maglalabas!",
      d: "Big C, Noon at Ngayon",
      aAuth: "Sanaysay",
      bAuth: "Infograpiko / Lungsod Maharlika",
      cAuth: "Dagli",
      dSource: "Kaalaman sa Kanser",
    },
  };

  const meta = titles[grade] || titles[7];

  const selections: GstSelection[] = [
    {
      letter: 'A',
      type: 'poem',
      typeLabel: 'Sipi A: Tula / Kuwento',
      title: meta.a,
      author: meta.aAuth,
      passageText: `Basahin at unawain ang akdang "${meta.a}" ni ${meta.aAuth}. Suriin ang mga tagpuan, tauhan, damdamin, at paksang-diwa ng akda.`,
      itemStart: 1,
      itemEnd: 10,
      questions: createStandardQuestions(1, 'A', meta.a, 'poem', grade, 'filipino'),
    },
    {
      letter: 'B',
      type: 'article',
      typeLabel: 'Sipi B: Tekstong Impormatibo',
      title: meta.b,
      author: meta.bAuth,
      passageText: `Basahin ang artikulong "${meta.b}". Bigyang-pansin ang mga pangunahing ideya, ebidensya, at pananaw na inilahad ng may-akda.`,
      itemStart: 11,
      itemEnd: 20,
      questions: createStandardQuestions(11, 'B', meta.b, 'article', grade, 'filipino'),
    },
    {
      letter: 'C',
      type: 'advisory',
      typeLabel: 'Sipi C: Gabay-Babala / Sanaysay',
      title: meta.c,
      author: meta.cAuth,
      passageText: `Basahin ang gabay at sanaysay ukol sa "${meta.c}". Suriin ang mga hakbang, babala, at pagpapahalagang panlipunan.`,
      itemStart: 21,
      itemEnd: 30,
      questions: createStandardQuestions(21, 'C', meta.c, 'advisory', grade, 'filipino'),
    },
    {
      letter: 'D',
      type: 'infographic',
      typeLabel: 'Sipi D: Infograpiko',
      title: meta.d,
      source: meta.dSource,
      passageText: `Suriin ang infograpiko tungkol sa "${meta.d}". Unawain ang mga datos, grapiko, porsyento, at mga opisyal na tagubilin.`,
      itemStart: 31,
      itemEnd: 40,
      questions: createStandardQuestions(31, 'D', meta.d, 'infographic', grade, 'filipino'),
    },
  ];

  return {
    gradeLevel: grade,
    stream: 'filipino',
    bookletTitle: 'PHILIPPINE INFORMAL READING INVENTORY (Phil-IRI)',
    subtitle: `Unang Yugto: Pangkatang Pagtatasa (GST) — Baitang ${grade} Filipino`,
    instructions: 'Panuto: Basahing mabuti ang bawat sipi. Pagkatapos, sagutin ang 10 tanong na sumusunod. Piliin ang titik ng pinakatamang sagot at itiman ang katumbas na bilog sa iyong sagutang papel (OMR sheet).',
    timeLimit: '45 hanggang 60 minuto',
    totalItems: 40,
    selections,
    allQuestions: selections.flatMap((s) => s.questions),
  };
}

function createStandardQuestions(
  startNum: number,
  selLetter: 'A' | 'B' | 'C' | 'D',
  title: string,
  type: string,
  grade: number,
  language: 'english' | 'filipino'
): GstQuestion[] {
  const isFil = language === 'filipino';
  const questions: GstQuestion[] = [];

  const domains: Array<'Literal' | 'Inferential' | 'Critical'> = [
    'Literal', 'Literal', 'Literal', 'Literal',
    'Inferential', 'Inferential', 'Inferential', 'Inferential',
    'Critical', 'Critical',
  ];

  const correctAnswers: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B'];

  for (let i = 0; i < 10; i++) {
    const num = startNum + i;
    const dom = domains[i];
    const ans = correctAnswers[i];

    let prompt = '';
    let choices: [string, string, string, string] = [
      'Pangunahing ideya A',
      'Pangalawang detalye B',
      'Maling hinuha C',
      'Hindi nabanggit D',
    ];

    if (!isFil) {
      if (dom === 'Literal') {
        prompt = `Based on the details provided in "${title}", which statement directly states an explicit fact?`;
        choices = [
          `The key events and facts described in ${title} took place as stated`,
          `The events were completely imagined and had no physical basis`,
          `The primary characters refused to participate in the activities`,
          `The document explicitly bans reading during daylight hours`,
        ];
      } else if (dom === 'Inferential') {
        prompt = `What can be logically inferred about the situation presented in "${title}"?`;
        choices = [
          `External conditions strongly influence the decisions made by the subjects`,
          `The individuals involved are indifferent to any environmental feedback`,
          `Nothing can be determined without contacting external researchers`,
          `All results observed are purely accidental and cannot be replicated`,
        ];
      } else {
        prompt = `How does "${title}" contribute to a student's broader critical understanding of societal or personal challenges?`;
        choices = [
          `It encourages active critical reflection, responsibility, and informed decision-making`,
          `It suggests that students should avoid participating in community initiatives`,
          `It proves that historical facts are irrelevant to modern problems`,
          `It demonstrates that emotions should be completely suppressed`,
        ];
      }
    } else {
      if (dom === 'Literal') {
        prompt = `Batay sa sipi na "${title}", alin sa mga sumusunod ang tiyak at tuwirang binanggit sa teksto?`;
        choices = [
          `Ang pangunahing kaisipan at mga pangyayari ay malinaw na inilahad sa akda`,
          `Hindi kailanman nangyari ang mga binanggit na sitwasyon`,
          `Mariing tinutulan ng may-akda ang pagpapahalaga sa kultura`,
          `Wala sa mga nabanggit ang may kinalaman sa paksang tinalakay`,
        ];
      } else if (dom === 'Inferential') {
        prompt = `Ano ang mahihinuha tungkol sa pangunahing mensahe ng may-akda sa "${title}"?`;
        choices = [
          `Ang mga karanasan at pagpapahalagang Pilipino ay humuhubog sa ating pagkakakilanlan`,
          `Walang kaugnayan ang nakaraan sa kasalukuyang pamumuhay ng kabataan`,
          `Higit na mahalaga ang materyal na bagay kaysa sa pamilya at kapwa`,
          `Dapat iwasan ang paggamit ng teknolohiya sa lahat ng pagkakataon`,
        ];
      } else {
        prompt = `Bilang isang mag-aaral sa Junior High School, paano mo ilalapat ang aral mula sa "${title}" sa iyong pang-araw-araw na buhay?`;
        choices = [
          `Maging mapanuri, responsable, at may malasakit sa pamilya at pamayanan`,
          `Balewalain ang mga alituntunin at gabay ng mga nakatatanda`,
          `Umasa na lamang sa tulong ng iba nang walang sariling pagkilos`,
          `Isantabi ang pag-aaral kapag may dumarating na pagsubok`,
        ];
      }
    }

    // Rearrange choices so correct answer matches ans
    const orderedChoices: [string, string, string, string] = [...choices];
    const targetIdx = ans === 'A' ? 0 : ans === 'B' ? 1 : ans === 'C' ? 2 : 3;
    if (targetIdx !== 0) {
      const temp = orderedChoices[0];
      orderedChoices[0] = orderedChoices[targetIdx];
      orderedChoices[targetIdx] = temp;
    }

    questions.push({
      number: num,
      prompt,
      choices: orderedChoices,
      correctAnswer: ans,
      domain: dom,
      selectionLetter: selLetter,
      selectionTitle: title,
    });
  }

  return questions;
}
