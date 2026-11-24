/*
 * Grey hint text drawn in the on-screen PREVIEW where a field is still empty
 * (e.g. right after "Clear form"), so the page shows the template's layout
 * instead of being blank. The downloaded PDF never contains these: only the
 * live preview turns them on (see `placeholders` in ResumeDocument).
 */
export const PLACEHOLDER = {
  color: "#A3AAB4",
  name: "Your Name",
  jobTitle: "Job Title",
  location: "City, Country",
  phone: "Phone number",
  email: "email@example.com",
  summary: "Your summary appears here: two or three sentences about your experience and strengths.",
  experienceTitle: "Job Title",
  company: "Company",
  dates: "Start – End",
  bullet: "Your achievements appear here, one per bullet.",
  degree: "Degree",
  institution: "School or university",
  year: "Year",
  skillGroup: "Skill group",
  skills: "Skill, Skill, Skill",
} as const;

/** Every placeholder sentence/word, for tests that check a PDF contains none of them. */
export const PLACEHOLDER_TEXTS: string[] = Object.entries(PLACEHOLDER)
  .filter(([key]) => key !== "color")
  .map(([, value]) => value);
