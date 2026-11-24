"use client";

/**
 * "Go to field": scrolls a form field into view, focuses it and briefly
 * highlights it. `path` is the form path, e.g. "personal.linkedin" or
 * "experience.2.company" (form fields have the id "field-<path with dashes>").
 * Returns false if the field isn't on the page.
 */
export function goToField(path: string): boolean {
  const el = document.getElementById(`field-${path.replace(/\./g, "-")}`);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.focus({ preventScroll: true });
  el.classList.remove("ats-highlight");
  void el.offsetWidth; // restart the highlight animation if it's already running
  el.classList.add("ats-highlight");
  window.setTimeout(() => el.classList.remove("ats-highlight"), 2600);
  return true;
}
