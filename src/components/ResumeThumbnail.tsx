import type { TemplateLayout } from "@/lib/templates";
import { tint, type AtsHeaderStyle } from "@/lib/theme";

/*
 * A small drawing of a resume's first page (name, title, colour, layout) for
 * cards. It's plain HTML/CSS with grey "text lines" - much lighter than
 * rendering a real PDF for every card. Purely decorative (aria-hidden).
 */

const Line = ({ w, color = "#D9DDE3", h = 3 }: { w: string; color?: string; h?: number }) => (
  <span className="block rounded-full" style={{ width: w, height: h, backgroundColor: color }} />
);

/** The slanted "skill bar" from the PDF, in miniature. */
const Bar = ({ accent, filled }: { accent: string; filled: number }) => (
  <span className="flex gap-[2px]">
    {Array.from({ length: 8 }, (_, i) => (
      <span
        key={i}
        className="block h-[4px] w-[5px] -skew-x-[20deg]"
        style={{ backgroundColor: i < filled ? accent : tint(accent, 0.75) }}
      />
    ))}
  </span>
);

export function ResumeThumbnail({
  name,
  title,
  accent,
  layout,
  atsHeader = "banner",
  accentHeadings = false,
}: {
  name: string;
  title: string;
  accent: string;
  layout: TemplateLayout;
  /** Modern ATS header design to draw (ignored for Classic Sidebar). */
  atsHeader?: AtsHeaderStyle;
  /** Template previews colour the section headings; resume cards keep them dark. */
  accentHeadings?: boolean;
}) {
  const heading = accentHeadings ? accent : "#3F4652";
  return (
    <div aria-hidden className="mx-auto flex h-full w-[84%] flex-col overflow-hidden bg-white text-left shadow-[0_2px_10px_rgba(15,23,42,0.12)]">
      {layout === "ats" ? (
        <AtsThumbnail name={name} title={title} accent={accent} header={atsHeader} />
      ) : (
        <>
          <div className="flex h-[17%] min-h-6">
            <div className="flex min-w-0 flex-1 items-center px-[7%]">
              <p className="truncate text-[9px] leading-tight" style={{ color: accent }}>
                {name}
              </p>
            </div>
            <div className="w-[34%]" style={{ backgroundColor: accent }} />
          </div>
          <div className="flex">
            <div className="flex-1 bg-[#F0F4F8] px-[7%] py-[3px]">
              <p className="truncate text-[5px] text-slate-600">{title}</p>
            </div>
            <div className="w-[34%] bg-[#F1F5F9]" />
          </div>
          <div className="flex flex-1">
            <div className="flex-1 space-y-[4px] px-[7%] pt-2.5">
              <Line w="46%" color={heading} h={3} />
              <Line w="92%" />
              <Line w="84%" />
              <span className="block h-1" />
              <Line w="40%" color={heading} h={3} />
              <Line w="90%" />
              <Line w="88%" />
              <Line w="74%" />
              <Line w="82%" />
            </div>
            <div className="w-[34%] space-y-[4px] bg-[#F1F5F9] px-[6%] pt-2.5">
              <Line w="70%" />
              <Line w="55%" />
              <span className="block h-1" />
              <Line w="60%" color="#3F4652" />
              <Bar accent={accent} filled={6} />
              <Line w="50%" />
              <Bar accent={accent} filled={8} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** Modern ATS in miniature: the chosen header, then sections with accent bars. */
function AtsThumbnail({ name, title, accent, header }: { name: string; title: string; accent: string; header: AtsHeaderStyle }) {
  const section = (titleWidth: string, lines: string[]) => (
    <>
      <span className="block h-[2px] w-[9%]" style={{ backgroundColor: accent }} />
      <Line w={titleWidth} color={accent} h={3} />
      {lines.map((w, i) => (
        <Line key={i} w={w} />
      ))}
      <span className="block h-[2px]" />
    </>
  );
  return (
    <div className="flex h-full flex-col">
      {header === "banner" ? (
        <div className="px-[9%] pb-2 pt-3 text-center" style={{ backgroundColor: accent }}>
          <p className="truncate text-[9px] font-bold leading-tight text-white">{name}</p>
          <p className="truncate text-[5.5px] text-white/90">{title}</p>
          <span className="mx-auto mt-[3px] block h-[2px] w-[70%] rounded-full bg-white/60" />
        </div>
      ) : header === "accent" ? (
        <div className="mx-[9%] mt-3 flex gap-[5px] border-b border-slate-100 pb-2">
          <span className="block w-[3px] shrink-0" style={{ backgroundColor: accent }} />
          <div className="min-w-0">
            <p className="truncate text-[9px] font-bold leading-tight" style={{ color: accent }}>
              {name}
            </p>
            <p className="truncate text-[5.5px] text-slate-500">{title}</p>
            <span className="mt-[3px] block"><Line w="90%" h={2} /></span>
          </div>
        </div>
      ) : (
        <div className="mx-[9%] mt-3 pb-1.5" style={{ borderBottom: `1.5px solid ${accent}` }}>
          <p className="truncate text-[9px] font-bold leading-tight" style={{ color: accent }}>
            {name}
          </p>
          <p className="truncate text-[5.5px] text-slate-500">{title}</p>
          <span className="mt-[3px] block"><Line w="78%" h={2} /></span>
        </div>
      )}
      <div className="space-y-[3px] px-[9%] pt-2">
        {section("26%", ["94%", "82%"])}
        {section("20%", ["70%", "62%"])}
        {section("38%", ["90%", "86%", "74%"])}
      </div>
    </div>
  );
}
