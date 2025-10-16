import { ChecklistItem } from '@/types';

// Resume verification checklist - validates key components of a professional resume
export const defaultChecklist: ChecklistItem[] = [
  {
    id: 1,
    description: 'Contact Information',
    criteria: 'Full name, phone number, email address, and location (city/state) clearly visible at the top of resume',
    status: 'pending',
  },
  {
    id: 2,
    description: 'Professional Summary or Objective',
    criteria: 'Brief professional summary or career objective statement (2-4 sentences) describing candidate background and goals',
    status: 'pending',
  },
  {
    id: 3,
    description: 'Work Experience Section',
    criteria: 'Work experience with job titles, company names, employment dates (month/year format), and detailed responsibilities or achievements',
    status: 'pending',
  },
  {
    id: 4,
    description: 'Education History',
    criteria: 'Educational background including degree(s), institution name(s), graduation date(s) or expected graduation date',
    status: 'pending',
  },
  {
    id: 5,
    description: 'Skills Section',
    criteria: 'Dedicated skills section listing relevant technical skills, tools, programming languages, or competencies',
    status: 'pending',
  },
  {
    id: 6,
    description: 'Professional Formatting',
    criteria: 'Consistent formatting with clear section headers, appropriate font sizes, proper spacing, and professional layout',
    status: 'pending',
  },
  {
    id: 7,
    description: 'Quantifiable Achievements',
    criteria: 'Work experience includes specific metrics, numbers, percentages, or measurable accomplishments (e.g., "increased sales by 25%")',
    status: 'pending',
  },
  {
    id: 8,
    description: 'Certifications or Additional Sections',
    criteria: 'Additional relevant sections such as certifications, projects, publications, awards, or volunteer experience',
    status: 'pending',
  },
];

