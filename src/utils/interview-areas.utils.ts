/** Display names for the areas the grader files each question and concept under. Shared by the page and the PDF. */
export const AREA_LABELS: Record<string, string> = {
  COMMUNICATION: 'Communication',
  FRONTEND: 'Frontend',
  BACKEND: 'Backend',
  DATABASE: 'Database',
  PROGRAMMING: 'Programming',
  DEVOPS_CLOUD: 'DevOps & Cloud',
  SYSTEM_DESIGN: 'System design',
  TESTING: 'Testing',
  BEHAVIOURAL: 'Behavioural',
  OTHER: 'Other',
};

export const areaLabel = (area: string): string => AREA_LABELS[area] ?? area;

/** How each expected concept went, in words. */
export const CONCEPT_STATUS_LABELS: Record<string, string> = {
  CORRECT: 'Correct',
  PARTIAL: 'Partly',
  INCORRECT: 'Not correct',
  NOT_ASKED: 'Not asked',
};
