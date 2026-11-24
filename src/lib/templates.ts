/*
 * Resume templates. A template is only a PDF design: every template reads the
 * same resume data, so switching never changes or loses content.
 */

export type TemplateLayout = "sidebar" | "ats";

export const TEMPLATES = [
  {
    id: "classic",
    name: "Classic Sidebar",
    description: "Two columns, skill bars and icons",
    layout: "sidebar",
    accent: "#E8726E",
    badge: "",
  },
  {
    id: "modern-ats",
    name: "Modern ATS",
    description: "One clean column for job portals",
    layout: "ats",
    accent: "#1E3A5F",
    badge: "Best for job portals",
  },
] as const satisfies readonly {
  id: string;
  name: string;
  description: string;
  layout: TemplateLayout;
  accent: string;
  badge: string;
}[];

export type TemplateId = (typeof TEMPLATES)[number]["id"];
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]];
export const DEFAULT_TEMPLATE: TemplateId = "classic";

/**
 * Template ids used by earlier versions of the app. Coral, Slate and Ocean
 * were the same two-column layout in different colours (the colour is saved
 * separately, so nothing changes). Minimal was the one-column layout that
 * Modern ATS replaces.
 */
const LEGACY_TEMPLATES: Record<string, TemplateId> = {
  coral: "classic",
  slate: "classic",
  ocean: "classic",
  minimal: "modern-ats",
};

/** Any saved template value -> a current template id (unknown/missing = Classic Sidebar). */
export function resolveTemplateId(value: unknown): TemplateId {
  if (typeof value !== "string") return DEFAULT_TEMPLATE;
  if (TEMPLATE_IDS.includes(value as TemplateId)) return value as TemplateId;
  return LEGACY_TEMPLATES[value] ?? DEFAULT_TEMPLATE;
}

export function templateInfo(id: string | undefined) {
  return TEMPLATES.find((t) => t.id === resolveTemplateId(id)) ?? TEMPLATES[0];
}
