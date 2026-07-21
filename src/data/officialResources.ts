export interface OfficialResource {
  id: string;
  provider: 'Microsoft Learn' | 'Coursera' | 'Udemy' | 'LinkedIn Learning' | 'edX' | 'FutureLearn' | 'AWS Skill Builder' | 'Google Skill Boost' | 'PMI' | 'CIPD' | 'YouTube (free)' | 'Other Platform';
  name: string;
  url: string;
  type: 'Free' | 'Paid' | 'Subscription';
  description?: string;
}

export const PRESET_OFFICIAL_RESOURCES: Record<string, OfficialResource[]> = {
  'pl-300': [
    {
      id: 'pl300-ms-learn',
      provider: 'Microsoft Learn',
      name: 'Microsoft Certified: Power BI Data Analyst Associate Study Path',
      url: 'https://learn.microsoft.com/en-us/credentials/certifications/power-bi-data-analyst-associate/',
      type: 'Free',
      description: 'The official self-paced learning path with hands-on sandboxes and practice assessments directly from Microsoft.'
    },
    {
      id: 'pl300-udemy',
      provider: 'Udemy',
      name: 'Microsoft Power BI Data Analyst Certification (PL-300) Course',
      url: 'https://www.udemy.com/course/microsoft-power-bi-data-analyst-certification-pl-300/',
      type: 'Paid',
      description: 'Comprehensive video lectures, realistic exam simulations, and downloadable resources by Maven Analytics.'
    },
    {
      id: 'pl300-coursera',
      provider: 'Coursera',
      name: 'Microsoft Power BI Data Analyst Professional Certificate',
      url: 'https://www.coursera.org/professional-certificates/microsoft-power-bi-data-analyst',
      type: 'Subscription',
      description: 'A 5-course series developed by Microsoft experts focusing on enterprise-scale business intelligence and interactive modeling.'
    },
    {
      id: 'pl300-youtube',
      provider: 'YouTube (free)',
      name: 'Power BI Full Course for Beginners (8 Hours)',
      url: 'https://www.youtube.com/watch?v=3u7Mef_m8T8',
      type: 'Free',
      description: 'Highly acclaimed complete walkthrough covering ETL pipelines, dashboard layouts, and DAX query foundations completely free.'
    },
    {
      id: 'pl300-linkedin',
      provider: 'LinkedIn Learning',
      name: 'Prepare for the Microsoft Power BI Data Analyst (PL-300) Exam',
      url: 'https://www.linkedin.com/learning/paths/prepare-for-the-microsoft-power-bi-data-analyst-pl-300-exam',
      type: 'Subscription',
      description: 'Structured LinkedIn path that reviews high-level design principles, row-level security, and analytical calculations.'
    }
  ],
  'pmp': [
    {
      id: 'pmp-pmi',
      provider: 'PMI',
      name: 'Official PMP® Exam Prep, Reference Materials & Syllabus',
      url: 'https://www.pmi.org/certifications/project-management-pmp',
      type: 'Paid',
      description: 'The official handbook, practice guides, and credential application portal hosted by the Project Management Institute.'
    },
    {
      id: 'pmp-udemy',
      provider: 'Udemy',
      name: 'PMP Exam Prep Seminar - Earn 35 Contact Hours',
      url: 'https://www.udemy.com/course/pmp-pmbok6-35-pdus/',
      type: 'Paid',
      description: 'Pass the PMP exam on your first try. Includes 35 contact hours required for the exam application, taught by Joseph Phillips.'
    },
    {
      id: 'pmp-coursera',
      provider: 'Coursera',
      name: 'Google Project Management: Professional Certificate',
      url: 'https://www.coursera.org/professional-certificates/google-project-management',
      type: 'Subscription',
      description: 'Develop high-demand project manager skills. Aligns directly with PMI education and offers a fast-track to PMP prep.'
    },
    {
      id: 'pmp-linkedin',
      provider: 'LinkedIn Learning',
      name: 'Cert Prep: Project Management Professional (PMP)®',
      url: 'https://www.linkedin.com/learning/cert-prep-project-management-professional-pmp-22007798',
      type: 'Subscription',
      description: 'Prepare to sit for the updated exam with standard video walkthroughs of agile, hybrid, and waterfall systems.'
    }
  ],
  'pmi-pba': [
    {
      id: 'pba-pmi',
      provider: 'PMI',
      name: 'PMI Professional in Business Analysis (PMI-PBA)® Official Page',
      url: 'https://www.pmi.org/certifications/business-analysis-pba',
      type: 'Paid',
      description: 'Official certification application guidelines, standards, and PMBOK extension references for professional BA paths.'
    },
    {
      id: 'pba-udemy',
      provider: 'Udemy',
      name: 'PMI-PBA Certification Training - Requirements & Traceability',
      url: 'https://www.udemy.com/course/pmi-pba-business-analysis-certification-training/',
      type: 'Paid',
      description: 'Detailed curriculum aligning with the PMI Business Analysis Guide, covering evaluation methodologies and needs assessments.'
    },
    {
      id: 'pba-linkedin',
      provider: 'LinkedIn Learning',
      name: 'Business Analysis Foundations & Elicitation Core',
      url: 'https://www.linkedin.com/learning/business-analysis-foundations-4',
      type: 'Subscription',
      description: 'Master the core workflows of requirements discovery, risk tracking, and stakeholder communication.'
    }
  ],
  'cipd-level-5': [
    {
      id: 'cipd5-cipd',
      provider: 'CIPD',
      name: 'CIPD Associate Diploma in People Management',
      url: 'https://www.cipd.org/uk/learning/qualifications/level-5-diploma-people-management/',
      type: 'Paid',
      description: 'The official professional benchmark for mid-level HR practitioners, leading to CIPD Associate Membership.'
    },
    {
      id: 'cipd5-futurelearn',
      provider: 'FutureLearn',
      name: 'CIPD-Aligned Human Resources Online Courses',
      url: 'https://www.futurelearn.com/subjects/business-and-management-courses/human-resources',
      type: 'Subscription',
      description: 'Interactive online classes built to expand people management metrics, UK labor law standards, and organizational psychology.'
    }
  ],
  'cipd-level-3': [
    {
      id: 'cipd3-cipd',
      provider: 'CIPD',
      name: 'CIPD Foundation Certificate in People Practice',
      url: 'https://www.cipd.org/uk/learning/qualifications/level-3-foundation-certificate/',
      type: 'Paid',
      description: 'The official entry point for HR professionals, covering recruiting, performance tracking, and talent basics.'
    }
  ],
  'cipd-level-7': [
    {
      id: 'cipd7-cipd',
      provider: 'CIPD',
      name: 'CIPD Level 7 Advanced Diploma in Strategic People Management',
      url: 'https://www.cipd.org/uk/learning/qualifications/level-7-advanced-diploma/',
      type: 'Paid',
      description: 'The highest professional CIPD level, designed for senior leaders formulating enterprise-scale talent and resource strategies.'
    }
  ],
  'aws-cloud': [
    {
      id: 'awsccp-aws',
      provider: 'AWS Skill Builder',
      name: 'AWS Cloud Practitioner Essentials (Self-Paced Course)',
      url: 'https://explore.skillbuilder.aws/learn/course/external/view/elearning/134/aws-cloud-practitioner-essentials',
      type: 'Free',
      description: 'The official Amazon self-paced course to learn cloud fundamentals, billing, architectural designs, and security policies.'
    },
    {
      id: 'awsccp-udemy',
      provider: 'Udemy',
      name: 'Ultimate AWS Certified Cloud Practitioner by Stephane Maarek',
      url: 'https://www.udemy.com/course/aws-certified-cloud-practitioner-clf-c01/',
      type: 'Paid',
      description: 'The highest-rated exam preparation boot camp with full-length realistic practice tests and architectural diagrams.'
    },
    {
      id: 'awsccp-coursera',
      provider: 'Coursera',
      name: 'AWS Cloud Technology Consultant Professional Certificate',
      url: 'https://www.coursera.org/professional-certificates/aws-cloud-technology-consultant',
      type: 'Subscription',
      description: 'Developed directly by Amazon Web Services, mapping AWS services to enterprise technology strategy.'
    }
  ],
  'aws-sa': [
    {
      id: 'awssa-aws',
      provider: 'AWS Skill Builder',
      name: 'Exam Prep: AWS Certified Solutions Architect - Associate Study Path',
      url: 'https://explore.skillbuilder.aws/learn/learning-path/view/72/solutions-architect-learning-plan',
      type: 'Free',
      description: 'Official modular preparation plan targeting highly available, resilient, secure, and cost-optimized workloads.'
    },
    {
      id: 'awssa-udemy',
      provider: 'Udemy',
      name: 'Ultimate AWS Certified Solutions Architect Associate by Stephane Maarek',
      url: 'https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03/',
      type: 'Paid',
      description: 'Deep-dive on compute, serverless, database architectures, network subnets, IAM policies, and cloud storage choices.'
    }
  ],
  'azure-fundamentals': [
    {
      id: 'az900-ms',
      provider: 'Microsoft Learn',
      name: 'AZ-900: Microsoft Azure Fundamentals Training Paths',
      url: 'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/',
      type: 'Free',
      description: 'Official self-paced interactive sandbox modules covering cloud services, private vs hybrid setups, and governance rules.'
    },
    {
      id: 'az900-coursera',
      provider: 'Coursera',
      name: 'Microsoft Azure Fundamentals AZ-900 Exam Prep Specialization',
      url: 'https://www.coursera.org/specializations/microsoft-azure-fundamentals-az-900',
      type: 'Subscription',
      description: 'Guided specialization detailing core VMs, container instances, security centers, and active directory features.'
    }
  ],
  'google-project-management': [
    {
      id: 'gpm-google',
      provider: 'Google Skill Boost',
      name: 'Google Project Management Program on Google Cloud Skills',
      url: 'https://www.cloudskillsboost.google/',
      type: 'Free',
      description: 'Gain insight into modern cloud-native project management styles, collaboration suites, and agile tracking tools.'
    },
    {
      id: 'gpm-coursera',
      provider: 'Coursera',
      name: 'Google Project Management Professional Certificate (Coursera)',
      url: 'https://www.coursera.org/professional-certificates/google-project-management',
      type: 'Subscription',
      description: 'Over 1 million enrolled. Covers agile practices, scrum events, key stakeholder communications, and documentation.'
    }
  ],
  'scrum-master': [
    {
      id: 'csm-coursera',
      provider: 'Coursera',
      name: 'Agnostic Scrum Master Certificate & Framework Course',
      url: 'https://www.coursera.org/specializations/product-management',
      type: 'Subscription',
      description: 'Master agile product development cycles, backlog pruning, daily scrum practices, and burndown analytics.'
    },
    {
      id: 'csm-udemy',
      provider: 'Udemy',
      name: 'Scrum Master Certification Prep + Practice Questions',
      url: 'https://www.udemy.com/course/scrum-master-certification-prep/',
      type: 'Paid',
      description: 'Clear, concise breakdown of the Scrum Guide with detailed practice exams targeting the PSM I or CSM requirements.'
    }
  ],
  'python-data-science': [
    {
      id: 'pyds-coursera',
      provider: 'Coursera',
      name: 'IBM Applied Data Science with Python Specialization',
      url: 'https://www.coursera.org/specializations/applied-data-science',
      type: 'Subscription',
      description: 'Analyze data with pandas, create interactive plots with matplotlib/seaborn, and run linear regression models.'
    },
    {
      id: 'pyds-edx',
      provider: 'edX',
      name: 'HarvardX: CS50\'s Introduction to Programming with Python',
      url: 'https://www.edx.org/course/cs50s-introduction-to-programming-with-python',
      type: 'Free',
      description: 'World-famous introductory programming class covering core concepts, custom library integrations, and testing frameworks.'
    },
    {
      id: 'pyds-youtube',
      provider: 'YouTube (free)',
      name: 'Python for Beginners - Full Crash Course (6 Hours)',
      url: 'https://www.youtube.com/watch?v=_uQrJ0TkZlc',
      type: 'Free',
      description: 'Excellent programming foundation by Mosh Hamedani. Fully covers loops, dictionaries, classes, and virtual envs.'
    }
  ],
  'advanced-sql': [
    {
      id: 'sql-coursera',
      provider: 'Coursera',
      name: 'SQL for Data Science by University of California, Davis',
      url: 'https://www.coursera.org/learn/sql-for-data-science',
      type: 'Subscription',
      description: 'Learn aggregate functions, join patterns, CTE tables, and query runtimes to structure large analytical queries.'
    },
    {
      id: 'sql-udemy',
      provider: 'Udemy',
      name: 'The Complete SQL Bootcamp: Go from Zero to Hero',
      url: 'https://www.udemy.com/course/the-complete-sql-bootcamp/',
      type: 'Paid',
      description: 'Practical exercises analyzing retail store transactions, writing complex subqueries, and grouping metrics with PostgreSQL.'
    },
    {
      id: 'sql-youtube',
      provider: 'YouTube (free)',
      name: 'SQL Tutorial for Beginners by freeCodeCamp (4.5 Hours)',
      url: 'https://www.youtube.com/watch?v=HXV3zeQKqGY',
      type: 'Free',
      description: 'Perfect visual breakdown of keys, primary relations, tables, subqueries, and window functions.'
    }
  ]
};

/**
 * Returns preset official resources for a given goal ID (supports matching by ID or fuzzy text)
 */
export function getOfficialResourcesForGoal(goalIdOrName: string): OfficialResource[] {
  const cleanId = goalIdOrName.toLowerCase().trim();

  // 1. Direct ID match
  if (PRESET_OFFICIAL_RESOURCES[cleanId]) {
    return PRESET_OFFICIAL_RESOURCES[cleanId];
  }

  // 2. Fuzzy match inside key
  const matchKey = Object.keys(PRESET_OFFICIAL_RESOURCES).find(k => 
    cleanId.includes(k) || k.includes(cleanId)
  );
  if (matchKey) {
    return PRESET_OFFICIAL_RESOURCES[matchKey];
  }

  // 3. Fallback generic suggestions based on terms in the name
  if (cleanId.includes('microsoft') || cleanId.includes('power bi') || cleanId.includes('azure') || cleanId.includes('ms-')) {
    return [
      {
        id: 'fallback-ms',
        provider: 'Microsoft Learn',
        name: 'Official Microsoft Learn Tech Hub',
        url: 'https://learn.microsoft.com',
        type: 'Free',
        description: 'Discover certified learning pathways, sandboxes, and documentation curated directly by Microsoft.'
      }
    ];
  }

  if (cleanId.includes('aws') || cleanId.includes('amazon')) {
    return [
      {
        id: 'fallback-aws',
        provider: 'AWS Skill Builder',
        name: 'AWS Skill Builder learning platform',
        url: 'https://aws.amazon.com/training/',
        type: 'Free',
        description: 'Explore core cloud modules, developer workshops, and test preparation paths directly from AWS.'
      }
    ];
  }

  if (cleanId.includes('google')) {
    return [
      {
        id: 'fallback-google',
        provider: 'Google Skill Boost',
        name: 'Google Cloud Skills Boost platform',
        url: 'https://www.cloudskillsboost.google/',
        type: 'Free',
        description: 'Explore interactive labs, certification training, and structured career path resources directly from Google.'
      }
    ];
  }

  if (cleanId.includes('pmi') || cleanId.includes('project') || cleanId.includes('scrum') || cleanId.includes('agile')) {
    return [
      {
        id: 'fallback-pmi',
        provider: 'PMI',
        name: 'Project Management Institute (PMI) Official Directory',
        url: 'https://www.pmi.org',
        type: 'Paid',
        description: 'Browse professional certification handbooks, syllabus details, exam requirements, and guides.'
      }
    ];
  }

  if (cleanId.includes('cipd') || cleanId.includes('hr') || cleanId.includes('people management')) {
    return [
      {
        id: 'fallback-cipd',
        provider: 'CIPD',
        name: 'CIPD Qualifications & Career Development',
        url: 'https://www.cipd.org',
        type: 'Paid',
        description: 'Official CIPD hub for people practitioners, offering UK-accredited certifications and regulatory resources.'
      }
    ];
  }

  // Default courses available on almost any topic on Coursera/Udemy/YouTube
  return [
    {
      id: 'fallback-coursera',
      provider: 'Coursera',
      name: `${goalIdOrName} Specializations on Coursera`,
      url: `https://www.coursera.org/search?query=${encodeURIComponent(goalIdOrName)}`,
      type: 'Subscription',
      description: 'Accredited university specializations and professional certificate pathways.'
    },
    {
      id: 'fallback-udemy',
      provider: 'Udemy',
      name: `${goalIdOrName} Top Rated Courses on Udemy`,
      url: `https://www.udemy.com/courses/search/?q=${encodeURIComponent(goalIdOrName)}`,
      type: 'Paid',
      description: 'Highly-rated video boot camps, practice questions, and code challenges from top instructors.'
    },
    {
      id: 'fallback-youtube',
      provider: 'YouTube (free)',
      name: `${goalIdOrName} Comprehensive Video Tutorials (free)`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(goalIdOrName + ' tutorial')}`,
      type: 'Free',
      description: 'Find excellent full-length crash courses, sample exams, and practical code breakdowns.'
    }
  ];
}
