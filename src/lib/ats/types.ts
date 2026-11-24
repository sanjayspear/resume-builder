/*
 * One result of the ATS check. Every result explains itself: what was found
 * (`message`), why it matters (`why`, one plain sentence) and, when it's
 * about a form field, where to fix it (`field`, for "Go to field").
 */

export type CheckStatus = "pass" | "warn" | "fail" | "info";

export type Check = {
  id: string;
  status: CheckStatus;
  /** Short name of the check, e.g. "LinkedIn profile". */
  title: string;
  /** What was found, e.g. "No LinkedIn link yet." */
  message: string;
  /** Why it matters, one plain sentence. */
  why: string;
  /** Few words for the summary line when it isn't a pass, e.g. "two-column layout". */
  reason?: string;
  /** Form field to jump to, e.g. "personal.linkedin" or "experience.2.company". */
  field?: string;
  /** An extra one-click fix shown with the result. */
  action?: "switch-to-modern-ats";
};
