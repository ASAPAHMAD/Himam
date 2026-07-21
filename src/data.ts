import { CourseSection, Lesson } from './services/Sync/types';

export const PL300_SECTIONS: CourseSection[] = [
  {
    sec: "Section 6 — Data Prep: Cleaning, Transforming & Loading",
    items: [
      ["38. Intro", 1], ["39. Basic Table Transformations", 8], ["40. Index Columns", 2],
      ["41. Conditional Columns", 3], ["42. Columns from Example", 7], ["43. Grouping & Aggregation", 4],
      ["44. Pivoting & Unpivoting", 7], ["45. Merging Queries", 4], ["46. Appending Queries", 4],
      ["47. Modifying Queries", 2], ["48. Intro to M Code & Editing Applied Steps", 5], ["49. The Advanced Editor", 7],
      ["50. Common M Function Categories", 4], ["51. M Code Syntax", 4], ["Quiz 3: Cleaning, Transforming & Loading", 10]
    ]
  },
  {
    sec: "Section 7 — Data Modeling 101",
    items: [
      ["52. Intro", 1], ["53. What is a Data Model?", 3], ["54. Data Tables vs. Lookup Tables", 3],
      ["55. Creating Table Relationships", 13], ["56. Relationship Cardinality & Filter Flow", 3],
      ["57. Active & Inactive Relationship", 4], ["58. Creating \"Snowflake\" Schemas", 4],
      ["59. Automatic Date Tables", 6], ["60. Date Table Requirements", 3], ["61. Model Optimization Tips", 2],
      ["Quiz 4: Data Modeling 101", 6]
    ]
  },
  {
    sec: "Section 8 — DAX Calculations",
    items: [
      ["62. Intro", 1], ["63. Meet DAX", 1], ["64. Calculated Columns", 8], ["65. Measures", 3],
      ["66. Quick Measures", 5], ["67. Common DAX Function Categories", 3], ["68. Basic Aggregation Functions", 4],
      ["69. Iterator Functions", 6], ["70. DIVIDE", 3], ["71. CALCULATE", 10], ["72. CALCULATE Modifiers", 4],
      ["73. USERELATIONSHIP", 6], ["74. ALL", 5], ["75. FILTER", 5], ["76. TOPN", 5],
      ["77. Time Intelligence Functions", 6], ["Quiz 5: DAX Calculations", 15]
    ]
  },
  {
    sec: "Section 9 — Creating Reports & Dashboards",
    items: [
      ["78. Intro", 1], ["79. Power BI Report View", 2], ["80. Objects & Basic Charts", 16],
      ["81. PRO TIP: Small Multiples", 7], ["82. Editing Report Interactions", 4], ["83. Drill-through Filters", 3],
      ["84. Bookmarks", 6], ["85. Tooltips", 2], ["86. Importing Custom Visuals", 4], ["87. R & Python Visuals", 2],
      ["88. Accessibility Features", 4], ["89. Creating a Dashboard in Power BI Service", 9],
      ["90. Dashboard Interface", 6], ["91. Web vs Mobile Layout", 4], ["Quiz 6: Creating Reports & Dashboards", 10],
      ["92. PRO TIP: Paginated Reports", 17], ["93. PRO TIP: Creating PivotTables from Power BI Datasets", 6]
    ]
  },
  {
    sec: "Section 10 — Enhancing Reports",
    items: [
      ["94. Intro", 1], ["95. Chart Types Based on Analysis", 2], ["96. Chart Analytics Options", 5],
      ["97. Q&A Visual", 6], ["98. Filtering Options", 3], ["99. Slicers", 3], ["100. Key Influencers Visual", 3],
      ["101. Decomposition Tree Visual", 4], ["Quiz 7: Enhancing Reports", 10], ["102. PRO TIP: Clustering", 6],
      ["103. PRO TIP: Grouping & Binning", 7]
    ]
  },
  {
    sec: "Section 11 — Deploying & Maintaining Deliverables",
    items: [
      ["104. Intro", 1], ["105. Scheduled Dataset Refresh", 3], ["106. Static Row-Level Security", 5],
      ["107. Dynamic RLS", 7], ["108. Apply RLS in Power BI Service", 5], ["109. PRO TIP: Azure Security Groups", 1],
      ["110. Subscriptions", 3], ["111. Sharing Options", 3], ["112. User Roles & Permissions", 4],
      ["113. Publishing Apps", 5], ["114. Deployment Pipelines", 2], ["115. Data Lineage", 5],
      ["116. Incremental Refresh & Query Folding", 4], ["117. Configuring Incremental Refresh", 10],
      ["118. Large Dataset Storage Format", 3], ["119. Endorsing Content", 3], ["120. Sensitivity Labels", 2],
      ["Quiz 8: Deploying & Maintaining Deliverables", 10]
    ]
  },
  {
    sec: "Section 12 — Practice Exam",
    items: [
      ["121. Practice Exam Intro", 3], ["122. Download: Practice Exam Resources", 1],
      ["123. Case Study #1: Introduction", 1], ["Quiz 9: Case Study #1 Questions", 5],
      ["Practice Test 1: DA-100 Practice Exam (do in ONE sitting)", 100],
      ["124. Case Study #1 Solution", 7], ["125. Case Study #2: Introduction", 1],
      ["Quiz 10: Case Study #2 Questions", 5], ["126. Case Study #2 Solution", 6]
    ]
  }
];

export const PMIPBA_SECTIONS: CourseSection[] = [
  {
    sec: "Ch.01 — Introduction to Business Analysis",
    items: [
      ["Introduction to Business Analysis", 15], ["Who is the Business Analyst?", 10],
      ["The Relationship Between PM, BA, and Sponsor", 12], ["Business Analysis Standard and Practice Guides", 8],
      ["Questions - Introduction", 15]
    ],
    preDone: 0
  },
  {
    sec: "Ch.02 — Needs Assessment",
    items: [
      ["Introduction - Needs Assessment", 18], ["1- Identify Problem or Opportunity", 15],
      ["2- Assess Current State & Define Future State", 20], ["3- Determine Viable Options & Provide Recommendation", 22],
      ["4- Facilitate Product Roadmap Development", 14], ["5- Assemble Business Case", 18],
      ["Keywords - Needs Assessment", 12], ["Needs Assessment in Mind Map", 8], ["Questions - Needs Assessment", 25]
    ]
  },
  {
    sec: "Ch.03 — Business Analysis Planning",
    items: [
      ["Introduction - BA Planning", 16], ["1- Conduct Stakeholder Analysis", 18],
      ["2- Define Business Analysis Plan", 20], ["3- Plan Elicitation & Analysis", 15],
      ["4- Plan Requirements Management & Traceability", 12], ["5- Plan Solution Evaluation", 10],
      ["Keywords - BA Planning", 10], ["Planning in Mind Map", 7], ["Questions - BA Planning", 20]
    ]
  },
  {
    sec: "Ch.04 — Requirements Elicitation - Overview & Prep",
    items: [
      ["Introduction - Requirements Elicitation", 12], ["1- Prepare for Elicitation", 15],
      ["2- Define Elicitation Scope & Objectives", 14], ["3- Identify Elicitation Sources & Participants", 16],
      ["Elicitation Mindset & Communication", 10], ["Questions - Elicitation Prep", 15]
    ]
  },
  {
    sec: "Ch.05 — Requirements Elicitation - Conduct Elicitation",
    items: [
      ["1- Conduct Elicitation: Brainstorming & Focus Groups", 18], ["2- Conduct Elicitation: Interviews & Surveys", 20],
      ["3- Conduct Elicitation: Observation & Document Analysis", 15], ["4- Conduct Elicitation: Interface Analysis & Prototyping", 16],
      ["5- Conduct Elicitation: Workshops & Collaborative Games", 18], ["Questions - Conduct Elicitation", 22]
    ]
  },
  {
    sec: "Ch.06 — Requirements Elicitation - Collaboration & Confirmation",
    items: [
      ["1- Document Elicitation Results", 14], ["2- Confirm Elicitation Results with Stakeholders", 16],
      ["3- Manage Elicitation Issues & Conflicts", 15], ["Keywords - Elicitation & Collaboration", 10],
      ["Elicitation in Mind Map", 8], ["Questions - Elicitation Confirmation", 18]
    ]
  },
  {
    sec: "Ch.07 — Analysis",
    items: [
      ["Introduction - Analysis", 17], ["1- Determine Analysis Approach", 7],
      ["2- Create and Analyze Models Part 01", 21], ["2- Create and Analyze Models Part 02", 21],
      ["2- Create and Analyze Models Part 03", 23], ["2- Create and Analyze Models Part 04", 8],
      ["3- Define and Elaborate Requirements", 22], ["4- Define Acceptance Criteria", 16],
      ["5- Verify Requirements", 23], ["6- Validate Requirements", 18],
      ["7- Prioritize Requirements Part 01", 26], ["7- Prioritize Requirements Part 02", 20],
      ["8- Identify and Analyze Product Risks", 24], ["9- Assess Product Design Options", 11],
      ["Keywords - Analysis", 22], ["Analysis in Mind Map", 10], ["Questions", 28]
    ]
  },
  {
    sec: "Ch.08 — Traceability and Monitoring",
    items: [
      ["Introduction - Traceability and Monitoring", 16], ["1- Determine Traceability and Monitoring Approach", 13],
      ["2- Establish Relationships and Dependencies", 25], ["3- Select and Approve Requirements", 23],
      ["4- Manage Changes to Requirements", 24], ["Keywords - Traceability and Monitoring", 8],
      ["Traceability and Monitoring in Mind Map", 8], ["Questions", 32]
    ]
  },
  {
    sec: "Ch.09 — Solution Evaluation",
    items: [
      ["Introduction - Solution Evaluation", 33], ["1- Determine Solution Evaluation Approach", 12],
      ["2- Evaluate Acceptance Results and Address Defects", 12], ["3- Evaluate Solution Performance", 18],
      ["4- Obtain Solution Acceptance for Release", 20], ["Steps of Solution Evaluation", 38],
      ["Keywords - Solution Evaluation", 8], ["Evaluation in Mind Map", 6], ["Questions", 11]
    ]
  },
  {
    sec: "PMI-PBA Exam Content Outline (reference)",
    items: [
      ["Domain 01: Needs Assessment", 9], ["Domain 02: Planning", 9], ["Domain 03: Analysis", 13],
      ["Domain 04: Traceability and Monitoring", 8], ["Domain 05: Evaluation", 9]
    ]
  },
  {
    sec: "PMI-PBA Fast Review",
    items: [
      ["Introduction - Business Analysis", 13], ["Needs Assessment Overview", 4], ["Needs Assessment Steps", 34],
      ["Needs Assessment in Mind Map", 7], ["Planning Overview", 5], ["Planning Steps", 26],
      ["Planning in Mind Map", 8], ["Analysis Overview", 6], ["Analysis Steps", 21],
      ["Analysis in Mind Map", 10], ["Traceability and Monitoring Overview", 5], ["Traceability and Monitoring Steps", 16],
      ["Traceability and Monitoring in Mind Map", 8], ["Evaluation Overview", 4], ["Evaluation Steps", 21],
      ["Evaluation in Mind Map", 6], ["Business Analysis All-in-One Mind Map", 13], ["Business Analysis in 20 Steps", 11]
    ]
  },
  {
    sec: "PMI-PBA Tips and Tricks",
    items: [
      ["Very Important Techniques Part 01", 40], ["Very Important Techniques Part 02", 18],
      ["Very Important Techniques Part 03", 13], ["Important Notes for Real Exam", 16], ["Very Important Keywords", 17]
    ]
  },
  {
    sec: "Very Important Questions",
    items: [
      ["Q1-10", 18], ["Q11-20", 20], ["Q21-30", 22]
    ]
  },
  {
    sec: "Agile Principles",
    items: [
      ["What is Agile?", 7], ["Agile Mindset", 9], ["Agile Triangle Model", 4], ["Agile Manifesto Overview", 7],
      ["Agile Values", 12], ["Agile Principles", 23], ["Project Life Cycle Characteristics", 28],
      ["Agile Methodologies", 5], ["Where to Apply Agile?", 1], ["Meaning of Scrum", 7], ["Scrum Pillars", 6],
      ["Overview - Scrum Framework", 5], ["Scrum Roles", 21], ["PM & SM & PO", 8], ["Scrum Artifacts", 14],
      ["Scrum Ceremonies", 27], ["Fast Review - Scrum Framework", 8]
    ]
  }
];

export const ALL_LESSONS: Lesson[] = (() => {
  const list: Lesson[] = [];
  PL300_SECTIONS.forEach((section, si) => {
    section.items.forEach((item, li) => {
      list.push({
        id: `pl300-s${si}-l${li}`,
        title: item[0],
        duration: item[1],
        course: 'PL-300',
        sectionName: section.sec,
        sectionIndex: si,
        lessonIndex: li
      });
    });
  });
  PMIPBA_SECTIONS.forEach((section, si) => {
    section.items.forEach((item, li) => {
      list.push({
        id: `pmipba-s${si}-l${li}`,
        title: item[0],
        duration: item[1],
        course: 'PMI-PBA',
        sectionName: section.sec,
        sectionIndex: si,
        lessonIndex: li
      });
    });
  });
  return list;
})();

export const INTERVIEW_QUESTIONS = [
  "Tell me about a time you found an error in data that others had already relied on.",
  "Walk me through how you'd design a KPI dashboard for a department that's never had one.",
  "Describe a situation where a stakeholder disagreed with your analysis. What did you do?",
  "Tell me about a report or process you automated. What was the impact?",
  "How do you decide what to measure when a business asks for 'better visibility'?",
  "Describe a time you had to explain a technical finding to a non-technical audience.",
  "Tell me about a project with an ambiguous or shifting scope. How did you handle it?",
  "What's a mistake you made in a dashboard or report, and how did you catch it?"
];

export const Q_BEHIND = [
  "You're a little behind pace — not a crisis, just a Tuesday. Pick one lesson and go.",
  "Behind schedule isn't behind for good. Today's 30 minutes still count exactly the same.",
  "The plan bends. The habit doesn't. Show up for the habit today.",
  "Catching up isn't about a big session — it's about not skipping today too.",
  "Nobody at Aramco is grading your pace. They'll grade the certificate. Keep moving."
];

export const Q_ONTRACK = [
  "Right on pace. Steady is how this actually gets finished.",
  "You're exactly where the plan expected you to be. That's the whole game.",
  "No drama today — just the next lesson, same as yesterday.",
  "This is what consistency looks like from the inside: unremarkable, and working.",
  "On track. Don't overthink it, just continue."
];

export const Q_AHEAD = [
  "You're ahead. Bank the lead — don't spend it by skipping tomorrow.",
  "Ahead of schedule. Good. That's slack for the days leave or family need you more.",
  "Being ahead means when life gets in the way, the plan doesn't break.",
  "You bought yourself margin. Use it for rest, not for stopping.",
  "Ahead of pace — this is exactly the kind of week to keep quiet about and just repeat."
];

export const Q_STREAK_BROKEN = [
  "Streak reset. That's data, not a verdict. Start today's count now.",
  "One missed day doesn't undo the ones before it. Begin again.",
  "The old streak is gone. The next one starts the moment you check a box today.",
  "No lecture needed — just open the next lesson and the count starts over.",
  "Progress isn't a straight line. Today's the next point on it."
];
