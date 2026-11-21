/*
 * Resume templates. A template is a layout plus a starting accent colour.
 * The user can still change the colour (and everything else) in Design.
 */

export type TemplateLayout = "sidebar" | "minimal";

export const TEMPLATES = [
  {
    id: "coral",
    name: "Coral sidebar",
    description: "Two columns, skills bars",
    layout: "sidebar",
    accent: "#E8726E",
  },
  {
    id: "slate",
    name: "Slate",
    description: "Two columns, quiet",
    layout: "sidebar",
    accent: "#3D4552",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Two columns, teal accent",
    layout: "sidebar",
    accent: "#0F766E",
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "One column, ATS-first",
    layout: "minimal",
    accent: "#1F2937",
  },
] as const satisfies readonly { id: string; name: string; description: string; layout: TemplateLayout; accent: string }[];

export type TemplateId = (typeof TEMPLATES)[number]["id"];
export const TEMPLATE_IDS = TEMPLATES.map((t) => t.id) as [TemplateId, ...TemplateId[]];
export const DEFAULT_TEMPLATE: TemplateId = "coral";

export function templateInfo(id: string | undefined) {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}
