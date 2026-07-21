import { LEGACY_COURSE_IDS } from '../../models/legacyBridge';
import { apiFetch } from '../../services/apiClient';

export interface GoalMetadata {
  rating?: number;
  providerName?: string;
  estimatedHours?: number;
  estimatedDuration?: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced' | string;
  skillsCovered?: string[];
  officialWebsite?: string;
  prerequisites?: string[];
  examInfo?: string;
}

export interface GoalSearchEntry {
  id: string;
  label: string;
  category: string;
  description?: string;
  /**
   * Set when this entry corresponds to a real catalog Course (currently only
   * the two migrated legacy courses). Selecting an entry with a courseId
   * carries it into Profile.learningGoalDetails so every consumer can match
   * by exact id instead of fuzzy label text — see courseCatalog.ts.
   */
  courseId?: string;

  // Refined ranking and synonym properties
  score?: number;
  confidence?: number;
  source?: string;
  aliases?: string[];
  metadata?: GoalMetadata;
}

export interface GoalSearchProvider {
  search(query: string): Promise<GoalSearchEntry[]>;
  getPopularGoals(): Promise<GoalSearchEntry[]>;
}

export const DEFAULT_GOAL_LIBRARY: GoalSearchEntry[] = [
  {
    id: 'cipd-level-3',
    label: 'CIPD Level 3 Foundation Certificate in People Practice',
    category: 'Certifications',
    description: 'Build a strong foundation in HR and people practice.',
  },
  {
    id: 'cipd-level-5',
    label: 'CIPD Level 5 Associate Diploma in People Management',
    category: 'Certifications',
    description: 'Advance into people management and HR operations.',
    metadata: {
      rating: 4.5,
      providerName: 'CIPD',
      estimatedHours: 180,
      estimatedDuration: '12 Weeks',
      difficulty: 'Intermediate',
      skillsCovered: ['People Management', 'HR Legislation', 'Talent Acquisition', 'Employee Relations'],
      officialWebsite: 'https://www.cipd.org/uk/learning/qualifications/level-5-diploma-people-management/',
      prerequisites: ['CIPD Level 3 or equivalent workplace HR experience'],
    }
  },
  {
    id: 'cipd-level-7',
    label: 'CIPD Level 7 Advanced Diploma',
    category: 'Certifications',
    description: 'Develop strategic HR and leadership capability.',
  },
  {
    id: 'pmp',
    label: 'PMP Certification',
    category: 'Certifications',
    description: 'Build strong project delivery and leadership habits.',
    aliases: ['PMP', 'Project Management Professional', 'PMP Certification'],
    metadata: {
      rating: 4.8,
      providerName: 'Project Management Institute (PMI)',
      estimatedHours: 200,
      estimatedDuration: '10 Weeks',
      difficulty: 'Advanced',
      skillsCovered: ['Project Integration', 'Scope Management', 'Risk Assessment', 'Agile & Hybrid Methodologies', 'Leadership'],
      officialWebsite: 'https://www.pmi.org/certifications/project-management-pmp',
      prerequisites: ['36 months of leading projects (with 4-year degree) or 60 months (with high school diploma)'],
      examInfo: '180 questions, 230 minutes, covers People, Process, and Business Environment.'
    }
  },
  {
    id: 'pl-300',
    label: 'PL-300: Power BI Data Analyst',
    category: 'Certifications',
    description: 'Analyze and present data with Microsoft Power BI.',
    courseId: LEGACY_COURSE_IDS.PL300,
    aliases: ['Power BI', 'PL-300', 'Microsoft PL-300', 'Power BI Data Analyst', 'PL300', 'Microsoft PL300'],
    metadata: {
      rating: 4.6,
      providerName: 'Microsoft',
      estimatedHours: 120,
      estimatedDuration: '8 Weeks',
      difficulty: 'Intermediate',
      skillsCovered: ['DAX (Data Analysis Expressions)', 'Power Query', 'Data Modeling', 'Data Visualization & Reporting'],
      officialWebsite: 'https://learn.microsoft.com/en-us/credentials/certifications/power-bi-data-analyst-associate/',
      prerequisites: ['Basic understanding of data concepts and SQL queries'],
      examInfo: 'Exam PL-300, 40-60 questions, 120 minutes. Passing score: 700/1000.'
    }
  },
  {
    id: 'pmi-pba',
    label: 'PMI-PBA: Business Analysis',
    category: 'Certifications',
    description: 'Build project requirements evaluation and business analysis skills.',
    courseId: LEGACY_COURSE_IDS.PMIPBA,
    aliases: ['PMI-PBA', 'Business Analysis', 'PMI-PBA: Business Analysis', 'PMIPBA', 'Business Analyst'],
    metadata: {
      rating: 4.5,
      providerName: 'Project Management Institute (PMI)',
      estimatedHours: 150,
      estimatedDuration: '9 Weeks',
      difficulty: 'Intermediate',
      skillsCovered: ['Needs Assessment', 'Requirements Elicitation & Analysis', 'Traceability & Monitoring', 'Solution Evaluation'],
      officialWebsite: 'https://www.pmi.org/certifications/business-analysis-pba',
      prerequisites: ['36 months of business analysis experience (with 4-year degree) or 60 months (with high school diploma)'],
      examInfo: '200 multiple-choice questions, 4 hours.'
    }
  },
  {
    id: 'cyber-security',
    label: 'Cyber Security Certification',
    category: 'Certifications',
    description: 'Explore core security principles and practical defense skills.',
  },
  {
    id: 'aws-cloud',
    label: 'AWS Certified Cloud Practitioner',
    category: 'Certifications',
    description: 'Build a practical understanding of cloud fundamentals.',
    aliases: ['AWS', 'Amazon Web Services', 'Cloud Practitioner', 'AWS Cloud Practitioner'],
    metadata: {
      rating: 4.7,
      providerName: 'Amazon Web Services (AWS)',
      estimatedHours: 80,
      estimatedDuration: '6 Weeks',
      difficulty: 'Beginner',
      skillsCovered: ['Cloud Computing Concepts', 'AWS Security & Compliance', 'AWS Core Services', 'Billing, Pricing & Support Models'],
      officialWebsite: 'https://aws.amazon.com/certification/certified-cloud-practitioner/',
      prerequisites: ['Basic IT knowledge and familiarity with internet concepts'],
      examInfo: 'Exam CLF-C02, 65 questions, 90 minutes. Passing score: 700/1000.'
    }
  },
  {
    id: 'aws-sa',
    label: 'AWS Certified Solutions Architect Associate',
    category: 'Certifications',
    description: 'Design scalable cloud systems using AWS services.',
  },
  {
    id: 'azure-fundamentals',
    label: 'Microsoft Azure Fundamentals AZ-900',
    category: 'Certifications',
    description: 'Get a strong foundation in cloud and Azure concepts.',
  },
  {
    id: 'azure-ai-engineer',
    label: 'Microsoft Azure AI Engineer Associate AI-102',
    category: 'Certifications',
    description: 'Build and deploy intelligent AI solutions on Azure.',
  },
  {
    id: 'google-analytics',
    label: 'Google Analytics Certification',
    category: 'Certifications',
    description: 'Measure digital marketing performance and user behavior.',
  },
  {
    id: 'google-project-management',
    label: 'Google Project Management Certificate',
    category: 'Certifications',
    description: 'Learn modern project planning and delivery practices.',
  },
  {
    id: 'cisco-ccna',
    label: 'Cisco CCNA Certification',
    category: 'Certifications',
    description: 'Develop networking knowledge for modern IT environments.',
  },
  {
    id: 'cisco-ccnp',
    label: 'Cisco CCNP Enterprise',
    category: 'Certifications',
    description: 'Advance your networking engineering and troubleshooting skills.',
  },
  {
    id: 'comptia-a',
    label: 'CompTIA A+ Certification',
    category: 'Certifications',
    description: 'Build practical IT support and hardware troubleshooting skills.',
  },
  {
    id: 'comptia-network',
    label: 'CompTIA Network+ Certification',
    category: 'Certifications',
    description: 'Strengthen your networking and infrastructure knowledge.',
  },
  {
    id: 'comptia-security',
    label: 'CompTIA Security+ Certification',
    category: 'Certifications',
    description: 'Learn core security operations and threat mitigation.',
  },
  {
    id: 'itil-4',
    label: 'ITIL 4 Foundation Certification',
    category: 'Certifications',
    description: 'Get a practical understanding of modern IT service management.',
  },
  {
    id: 'scrum-master',
    label: 'Certified ScrumMaster',
    category: 'Certifications',
    description: 'Lead agile teams with structured delivery and facilitation.',
  },
  {
    id: 'psm',
    label: 'Professional Scrum Master',
    category: 'Certifications',
    description: 'Deepen your understanding of Scrum roles and team dynamics.',
  },
  {
    id: 'prince2',
    label: 'PRINCE2 Foundation',
    category: 'Certifications',
    description: 'Learn structured project governance and delivery methods.',
  },
  {
    id: 'lean-six-sigma',
    label: 'Lean Six Sigma Green Belt',
    category: 'Certifications',
    description: 'Apply process improvement and quality management methods.',
  },
  {
    id: 'data-analyst',
    label: 'Google Data Analytics Professional Certificate',
    category: 'Certifications',
    description: 'Build analytics and reporting skills for modern organizations.',
  },
  {
    id: 'machine-learning',
    label: 'Machine Learning Engineer Certificate',
    category: 'Certifications',
    description: 'Develop AI systems with practical modeling and deployment skills.',
  },
  {
    id: 'mba',
    label: 'MBA Degree',
    category: 'University Degrees',
    description: 'Advance into strategic leadership and business management.',
    aliases: ['MBA', 'Master of Business Administration', 'MBA Degree'],
    metadata: {
      rating: 4.9,
      providerName: 'Business Schools',
      estimatedHours: 1200,
      estimatedDuration: '2 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Strategic Leadership', 'Corporate Finance', 'Marketing Strategy', 'Organizational Behavior', 'Operations Management'],
      officialWebsite: 'https://www.aacsb.edu/students/degrees/mba',
      prerequisites: ['Bachelor\'s degree and GMAT/GRE (varies by institution)'],
    }
  },
  {
    id: 'bachelors-business',
    label: 'BBA Business Administration',
    category: 'University Degrees',
    description: 'Strengthen your foundations in business operations and strategy.',
  },
  {
    id: 'bachelors-computer-science',
    label: 'B.S. Computer Science',
    category: 'University Degrees',
    description: 'Strengthen your foundations in programming and systems.',
  },
  {
    id: 'masters-cs',
    label: 'M.S. Computer Science',
    category: 'University Degrees',
    description: 'Advance your technical depth in computing and research.',
  },
  {
    id: 'masters-data-science',
    label: 'M.S. Data Science',
    category: 'University Degrees',
    description: 'Build advanced analytical and machine learning capabilities.',
    aliases: ['M.S. Data Science', 'MSDS', 'Master of Science in Data Science'],
    metadata: {
      rating: 4.8,
      providerName: 'University Program',
      estimatedHours: 900,
      estimatedDuration: '1.5 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Machine Learning', 'Statistical Inference', 'Data Engineering & Pipelines', 'Big Data Technologies', 'Data Visualization'],
      prerequisites: ['Bachelor\'s degree in quantitative field (CS, Math, Engineering) and programming proficiency'],
    }
  },
  {
    id: 'phd-data-science',
    label: 'PhD Data Science',
    category: 'University Degrees',
    description: 'Pursue advanced research and specialized expertise.',
  },
  {
    id: 'bachelors-engineering',
    label: 'B.Eng. / B.E. Engineering',
    category: 'University Degrees',
    description: 'Study engineering fundamentals across civil, mechanical, software, and electrical domains.',
  },
  {
    id: 'masters-engineering',
    label: 'M.Eng. / M.Sc. Engineering Management',
    category: 'University Degrees',
    description: 'Advance engineering leadership, systems thinking, and technical management skills.',
  },
  {
    id: 'bachelors-accounting',
    label: 'B.Sc. / B.Com. Accounting',
    category: 'University Degrees',
    description: 'Build expertise in accounting, audit, and financial reporting.',
  },
  {
    id: 'masters-accounting',
    label: 'M.Acc. / M.Sc. Accounting',
    category: 'University Degrees',
    description: 'Develop advanced financial analysis, auditing, and compliance expertise.',
  },
  {
    id: 'bachelors-finance',
    label: 'B.Fin. / BBA Finance',
    category: 'University Degrees',
    description: 'Learn corporate finance, investment principles, and economic analysis.',
  },
  {
    id: 'masters-finance',
    label: 'M.Sc. Finance / MBA Finance',
    category: 'University Degrees',
    description: 'Advance into portfolio strategy, financial modeling, and leadership.',
  },
  {
    id: 'bachelors-marketing',
    label: 'BBA Marketing',
    category: 'University Degrees',
    description: 'Build skills in branding, consumer behavior, and digital campaigns.',
  },
  {
    id: 'masters-marketing',
    label: 'M.Sc. Marketing / MBA Marketing',
    category: 'University Degrees',
    description: 'Explore advanced positioning, analytics, and strategic growth.',
  },
  {
    id: 'bachelors-psychology',
    label: 'B.A. / B.Sc. Psychology',
    category: 'University Degrees',
    description: 'Study human behavior, research, and applied mental health foundations.',
  },
  {
    id: 'masters-psychology',
    label: 'M.A. / M.Sc. Psychology',
    category: 'University Degrees',
    description: 'Advance into counseling, research, or applied psychology practice.',
  },
  {
    id: 'bachelors-nursing',
    label: 'B.Sc. Nursing',
    category: 'University Degrees',
    description: 'Prepare for clinical care, patient support, and healthcare practice.',
  },
  {
    id: 'masters-nursing',
    label: 'M.Sc. Nursing / Nurse Practitioner',
    category: 'University Degrees',
    description: 'Advance into specialty care, leadership, and advanced practice.',
  },
  {
    id: 'bachelors-medicine',
    label: 'MBBS / MD Medical Degree',
    category: 'University Degrees',
    description: 'Study medicine and healthcare delivery in a globally recognized pathway.',
  },
  {
    id: 'specialty-dermatology',
    label: 'Dermatology Specialization / Residency (Derma)',
    category: 'University Degrees',
    description: 'Master clinical, surgical, and cosmetic dermatology diagnosis and treatment.',
    aliases: ['Dermatology', 'Derma', 'Skin care', 'Dermatologist'],
    metadata: {
      rating: 4.9,
      providerName: 'Medical Specialty Board',
      estimatedHours: 1500,
      estimatedDuration: '3 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Clinical Dermatology', 'Dermatopathology', 'Surgical Derm', 'Cosmetic Laser Treatment'],
    }
  },
  {
    id: 'specialty-family-medicine',
    label: 'Family Medicine Specialization / Residency',
    category: 'University Degrees',
    description: 'Comprehensive primary care training covering patients of all ages, preventive care, and chronic conditions.',
    aliases: ['Family Medicine', 'GP', 'General Practice', 'Primary Care Physician'],
    metadata: {
      rating: 4.8,
      providerName: 'Medical Specialty Board',
      estimatedHours: 1200,
      estimatedDuration: '3 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Preventive Care', 'Pediatric Checkups', 'Geriatric Care', 'Chronic Illness Management'],
    }
  },
  {
    id: 'specialty-internal-medicine',
    label: 'Internal Medicine Specialization / Residency',
    category: 'University Degrees',
    description: 'Specialized focus on prevention, diagnosis, and treatment of complex adult acute and chronic conditions.',
    aliases: ['Internal Medicine', 'Internist', 'Adult Medicine'],
    metadata: {
      rating: 4.8,
      providerName: 'Medical Specialty Board',
      estimatedHours: 1350,
      estimatedDuration: '3 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Cardiovascular Care', 'Gastroenterology', 'Endocrine Systems', 'Critical Care'],
    }
  },
  {
    id: 'specialty-pediatrics',
    label: 'Pediatrics Specialization / Residency',
    category: 'University Degrees',
    description: 'Specialized healthcare training for infants, children, and adolescents focusing on physical and mental development.',
    aliases: ['Pediatrics', 'Pediatrician', 'Child Health', 'Paediatrics'],
    metadata: {
      rating: 4.9,
      providerName: 'Medical Specialty Board',
      estimatedHours: 1200,
      estimatedDuration: '3 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Neonatology', 'Childhood Milestones', 'Pediatric Pharmacology', 'Immunization Schedules'],
    }
  },
  {
    id: 'specialty-general-surgery',
    label: 'General Surgery Specialization / Residency',
    category: 'University Degrees',
    description: 'In-depth surgical expertise covering abdominal organs, trauma care, and endocrine systems.',
    aliases: ['General Surgery', 'Surgeon', 'Surgical Residency'],
    metadata: {
      rating: 4.9,
      providerName: 'Surgical Specialty Board',
      estimatedHours: 1800,
      estimatedDuration: '5 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Abdominal Surgery', 'Trauma Resuscitation', 'Surgical Oncology', 'Post-Op Management'],
    }
  },
  {
    id: 'specialty-cardiology',
    label: 'Cardiology Fellowship / Specialization',
    category: 'University Degrees',
    description: 'Advanced cardiovascular specialty focusing on diagnostic imaging, electrophysiology, and interventional procedures.',
    aliases: ['Cardiology', 'Cardiologist', 'Heart Specialist'],
    metadata: {
      rating: 5.0,
      providerName: 'Cardiovascular Specialty Board',
      estimatedHours: 1600,
      estimatedDuration: '3 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Echocardiography', 'Cardiac Catheterization', 'Heart Failure Management', 'Electrocardiography (ECG)'],
    }
  },
  {
    id: 'specialty-psychiatry',
    label: 'Psychiatry Specialization / Residency',
    category: 'University Degrees',
    description: 'In-depth training on diagnosing, preventing, and treating mental, emotional, and behavioral disorders.',
    aliases: ['Psychiatry', 'Psychiatrist', 'Mental Health Specialist'],
    metadata: {
      rating: 4.8,
      providerName: 'Medical Specialty Board',
      estimatedHours: 1200,
      estimatedDuration: '4 Years',
      difficulty: 'Advanced',
      skillsCovered: ['Psychopharmacology', 'Cognitive Behavioral Therapy (CBT)', 'Addiction Psychiatry', 'Neurological Diagnosis'],
    }
  },
  {
    id: 'masters-medicine',
    label: 'Master of Public Health / MPH',
    category: 'University Degrees',
    description: 'Build expertise in public health systems, policy, and prevention.',
  },
  {
    id: 'bachelors-law',
    label: 'LL.B. Bachelor of Laws',
    category: 'University Degrees',
    description: 'Study legal principles, governance, and justice systems.',
  },
  {
    id: 'masters-law',
    label: 'LL.M. Master of Laws',
    category: 'University Degrees',
    description: 'Specialize in international, corporate, or human rights law.',
  },
  {
    id: 'bachelors-education',
    label: 'B.Ed. Education',
    category: 'University Degrees',
    description: 'Prepare for teaching, curriculum design, and classroom leadership.',
  },
  {
    id: 'masters-education',
    label: 'M.Ed. Education',
    category: 'University Degrees',
    description: 'Advance into educational leadership, policy, and curriculum strategy.',
  },
  {
    id: 'bachelors-architecture',
    label: 'B.Arch. Architecture',
    category: 'University Degrees',
    description: 'Study design, structures, urban planning, and built environments.',
  },
  {
    id: 'masters-architecture',
    label: 'M.Arch. Architecture',
    category: 'University Degrees',
    description: 'Develop advanced architectural design and professional practice skills.',
  },
  {
    id: 'bachelors-design',
    label: 'B.Des. / BFA Design',
    category: 'University Degrees',
    description: 'Build creative expertise in visual, digital, and product design.',
  },
  {
    id: 'masters-design',
    label: 'M.Des. / MFA Design',
    category: 'University Degrees',
    description: 'Advance your design strategy, research, and creative leadership.',
  },
  {
    id: 'certified-public-accountant',
    label: 'Certified Public Accountant (CPA)',
    category: 'Certifications',
    description: 'Gain an internationally recognized accounting qualification.',
  },
  {
    id: 'acca',
    label: 'ACCA Qualification',
    category: 'Certifications',
    description: 'Develop expertise in accounting, audit, and finance worldwide.',
  },
  {
    id: 'cfa',
    label: 'CFA Charterholder Program',
    category: 'Certifications',
    description: 'Prepare for investment analysis, portfolio management, and finance leadership.',
  },
  {
    id: 'financial-planner',
    label: 'Certified Financial Planner (CFP)',
    category: 'Certifications',
    description: 'Strengthen your wealth planning and financial advisory skills.',
  },
  {
    id: 'soc-2',
    label: 'SOC 2 Compliance Certification',
    category: 'Certifications',
    description: 'Learn governance and trust services for secure technology operations.',
  },
  {
    id: 'iso-27001',
    label: 'ISO 27001 Lead Implementer',
    category: 'Certifications',
    description: 'Build practical information security management knowledge.',
  },
  {
    id: 'capm',
    label: 'CAPM Certification',
    category: 'Certifications',
    description: 'Get started with foundational project management knowledge.',
  },
  {
    id: 'cbap',
    label: 'CBAP Business Analysis Certification',
    category: 'Certifications',
    description: 'Advance your business analysis and requirements strategy skills.',
  },
  {
    id: 'professional-english',
    label: 'Professional English',
    category: 'Languages',
    description: 'Improve workplace communication and business vocabulary.',
  },
  {
    id: 'python-data-science',
    label: 'Python for Data Science',
    category: 'Technical Skills',
    description: 'Learn Python workflows for analysis and machine learning.',
  },
  {
    id: 'advanced-sql',
    label: 'Advanced SQL & Querying',
    category: 'Technical Skills',
    description: 'Sharpen your database and query design skills.',
  },
  {
    id: 'spanish',
    label: 'Spanish A2: Conversational',
    category: 'Languages',
    description: 'Practice everyday conversation and travel vocabulary.',
  },
];

export function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
}

export function scoreEntry(entry: GoalSearchEntry, normalized: string): number {
  const haystack = [entry.label, entry.category, entry.description].filter(Boolean).join(' ').toLowerCase();
  if (!normalized) return 0;
  if (haystack === normalized) return 140;

  const queryTokens = tokenize(normalized);
  const haystackTokens = tokenize(haystack);

  // If query is very short, be strict: must have at least one token that matches as a whole-word or starts with the query
  if (normalized.length <= 3) {
    const hasWordOrPrefix = haystackTokens.some(t => t === normalized || t.startsWith(normalized));
    if (!hasWordOrPrefix) {
      return 0; // Filter out completely (e.g., "hr" matching inside "threat" is rejected)
    }
  }

  // If the exact normalized phrase is found inside haystack, check if it aligns with word boundaries
  if (haystack.includes(normalized)) {
    const index = haystack.indexOf(normalized);
    const beforeChar = index > 0 ? haystack[index - 1] : ' ';
    const afterChar = index + normalized.length < haystack.length ? haystack[index + normalized.length] : ' ';
    const isWordBounded = /[^a-z0-9]/.test(beforeChar) && /[^a-z0-9]/.test(afterChar);
    
    if (isWordBounded) {
      return 120;
    }
  }

  const tokenMatches = queryTokens.filter(token => haystackTokens.includes(token)).length;
  const prefixMatches = queryTokens.filter(token => haystackTokens.some(h => h.startsWith(token))).length;
  const partialMatches = queryTokens.filter(token => haystackTokens.some(h => h.includes(token))).length;
  const fuzzyMatches = queryTokens.filter(token => {
    if (token.length <= 2) return false; // don't fuzzy-match very short tokens
    const prefix = token.slice(0, Math.min(3, token.length));
    return haystackTokens.some(h => h.length > 2 && h.includes(prefix));
  }).length;

  const tokenScore = tokenMatches * 40; // High weight to whole token matches
  const prefix = prefixMatches > 0 ? 25 : 0;
  const contains = partialMatches > 0 ? 10 : 0; // Lower weight to partial substring matching
  const fuzzy = fuzzyMatches > 0 ? 5 : 0;
  
  return tokenScore + prefix + contains + fuzzy;
}

export function scoreEntryWithAlias(entry: GoalSearchEntry, normalizedQuery: string): { score: number; confidence: number } {
  let bestScore = scoreEntry(entry, normalizedQuery);
  
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      const aliasLower = alias.toLowerCase();
      if (aliasLower === normalizedQuery) {
        bestScore = Math.max(bestScore, 150);
      } else if (aliasLower.includes(normalizedQuery) || normalizedQuery.includes(aliasLower)) {
        bestScore = Math.max(bestScore, 130);
      } else {
        const aliasTokens = tokenize(aliasLower);
        const queryTokens = tokenize(normalizedQuery);
        const matches = queryTokens.filter(t => aliasTokens.includes(t)).length;
        if (matches > 0) {
          bestScore = Math.max(bestScore, matches * 30 + 40);
        }
      }
    }
  }

  let confidence = 0.0;
  if (bestScore >= 140) {
    confidence = 1.0;
  } else if (bestScore >= 120) {
    confidence = 0.95;
  } else if (bestScore > 0) {
    confidence = Math.min(0.9, parseFloat((bestScore / 130).toFixed(2)));
  }

  return { score: bestScore, confidence };
}

export class InMemoryGoalSearchProvider implements GoalSearchProvider {
  constructor(private readonly entries: GoalSearchEntry[] = DEFAULT_GOAL_LIBRARY) {}

  async search(query: string): Promise<GoalSearchEntry[]> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return this.entries.map(e => ({
        ...e,
        score: 0,
        confidence: 1.0,
        source: 'local-catalog'
      }));
    }

    return this.entries
      .map(entry => {
        const { score, confidence } = scoreEntryWithAlias(entry, normalized);
        return {
          ...entry,
          score,
          confidence,
          source: 'local-catalog'
        };
      })
      .filter(item => (item.score || 0) > 0)
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  async getPopularGoals(): Promise<GoalSearchEntry[]> {
    return this.entries.slice(0, 6).map(e => ({
      ...e,
      score: 0,
      confidence: 1.0,
      source: 'local-catalog'
    }));
  }
}

export class CompositeGoalSearchProvider implements GoalSearchProvider {
  constructor(private readonly providers: GoalSearchProvider[]) {}

  async search(query: string): Promise<GoalSearchEntry[]> {
    const allResults = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          return await provider.search(query);
        } catch (err) {
          console.error('Provider search failure:', err);
          return [];
        }
      })
    );

    const mergedMap = new Map<string, GoalSearchEntry>();

    for (const providerResults of allResults) {
      for (const entry of providerResults) {
        const existing = mergedMap.get(entry.id);
        if (existing) {
          const mergedScore = Math.max(existing.score || 0, entry.score || 0);
          const mergedConfidence = Math.max(existing.confidence || 0, entry.confidence || 0);
          
          const sources = new Set(
            [existing.source, entry.source].flatMap(s => s ? s.split('+') : [])
          );
          const mergedSource = Array.from(sources).join('+');

          mergedMap.set(entry.id, {
            ...existing,
            score: mergedScore,
            confidence: mergedConfidence,
            source: mergedSource,
          });
        } else {
          mergedMap.set(entry.id, { ...entry });
        }
      }
    }

    return Array.from(mergedMap.values())
      .sort((a, b) => {
        const scoreDiff = (b.score || 0) - (a.score || 0);
        if (scoreDiff !== 0) return scoreDiff;
        const confidenceDiff = (b.confidence || 0) - (a.confidence || 0);
        if (confidenceDiff !== 0) return confidenceDiff;
        return a.label.localeCompare(b.label);
      });
  }

  async getPopularGoals(): Promise<GoalSearchEntry[]> {
    const allPopular = await Promise.all(
      this.providers.map(async (p) => {
        try {
          return await p.getPopularGoals();
        } catch {
          return [];
        }
      })
    );

    const mergedMap = new Map<string, GoalSearchEntry>();
    for (const results of allPopular) {
      for (const entry of results) {
        if (!mergedMap.has(entry.id)) {
          mergedMap.set(entry.id, entry);
        }
      }
    }
    return Array.from(mergedMap.values()).slice(0, 6);
  }
}

export class LocalCatalogGoalSearchProvider extends InMemoryGoalSearchProvider {}

export class ServerAIGoalSearchProvider implements GoalSearchProvider {
  async search(query: string): Promise<GoalSearchEntry[]> {
    const trimmed = query.trim();
    if (trimmed.length < 2) return [];

    try {
      const response = await apiFetch('/api/goals/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed })
      });
      if (!response.ok) {
        throw new Error('API request failed');
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          ...item,
          source: 'ai-worldwide'
        }));
      }
      return [];
    } catch (err) {
      console.error('Server AI Goal search failed:', err);
      return [];
    }
  }

  async getPopularGoals(): Promise<GoalSearchEntry[]> {
    return [];
  }
}

