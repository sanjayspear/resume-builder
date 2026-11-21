import { Document, Image, Link, Page, Polygon, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { createContext, Fragment, useContext, type ComponentProps } from "react";
import { sortExperience } from "@/lib/experienceSort";
import { languageLevelInfo } from "@/lib/languages";
import { templateInfo } from "@/lib/templates";
import { flattenDoc, type RichInline, type RichUnit } from "@/lib/richText";
import type { Experience, Language, ResumeData, SkillGroup } from "@/lib/schema";
import { DEFAULT_FONT_SIZE, normalizeStyle, tint } from "@/lib/theme";
import { GlobeIcon, MailIcon, PhoneIcon, PinIcon } from "./icons";

/* ---------- Fixed design tokens (from the original design reference) ---------- */

const SIDEBAR_BG = "#F1F5F9";
const STRIP_BG = "#F0F4F8";
const SIDEBAR_HEAD_BG = "#E4E9ED";
const INK = "#222222";
const MUTED = "#5F6368";
const LINK = "#2F7DC1";

const PAGE_WIDTH = 595.28; // A4 width in PDF points (1pt = 1/72 inch)
const SIDEBAR_WIDTH = Math.round(PAGE_WIDTH * 0.34);
const MAIN_WIDTH = PAGE_WIDTH - SIDEBAR_WIDTH;
const PAGE_PAD_Y = 30; // top/bottom white space on every page
const MAIN_PAD_X = 24;
const SIDE_PAD_X = 18;
const DATE_COL = 64; // narrow date column in Work experience / Education
const RATING_BAR_WIDTH = SIDEBAR_WIDTH - SIDE_PAD_X * 2;

/* ---------- Styles that depend on the user's Design choices ---------- */

/**
 * Builds the stylesheet for one resume's style (font, size, spacing, colour).
 * Every text size is scaled from the base size, so "10 pt" grows the whole
 * document proportionally instead of only the body text.
 */
function makeTheme(style: ResumeData["style"] | undefined) {
  const { fontFamily, fontSize, lineHeight, accentColor, logoSize } = normalizeStyle(style);
  const k = fontSize / DEFAULT_FONT_SIZE;
  const size = (pt: number) => Math.round(pt * k * 100) / 100;
  const accentFaded = tint(accentColor, 0.78);

  const s = StyleSheet.create({
    page: {
      fontFamily,
      fontSize,
      lineHeight,
      color: INK,
      paddingTop: PAGE_PAD_Y,
      paddingBottom: PAGE_PAD_Y,
    },
    // Light blue-grey sidebar background, repeated on every page via `fixed`.
    sidebarBackground: {
      position: "absolute",
      top: 0,
      bottom: 0,
      right: 0,
      width: SIDEBAR_WIDTH,
      backgroundColor: SIDEBAR_BG,
    },

    /* Header (page 1 only). The negative margin cancels the page's top padding. */
    header: { marginTop: -PAGE_PAD_Y },
    nameRow: { flexDirection: "row" },
    nameBox: {
      width: MAIN_WIDTH,
      paddingTop: 18,
      paddingBottom: 10,
      paddingHorizontal: MAIN_PAD_X,
      backgroundColor: "#FFFFFF",
    },
    name: { fontSize: size(31), lineHeight: 1.1, color: accentColor },
    accentBlock: { width: SIDEBAR_WIDTH, backgroundColor: accentColor },
    strip: {
      width: MAIN_WIDTH,
      backgroundColor: STRIP_BG,
      paddingVertical: 16,
      paddingHorizontal: MAIN_PAD_X,
    },
    stripNotch: { position: "absolute", top: 0, left: 38 },
    jobTitle: { fontSize: size(15), lineHeight: 1.2 },

    /* Two-column body */
    body: { flexDirection: "row" },
    main: { width: MAIN_WIDTH, paddingTop: 18, paddingLeft: MAIN_PAD_X, paddingRight: 20 },
    sidebar: { width: SIDEBAR_WIDTH, paddingTop: 16 },

    sectionHeading: {
      fontSize: size(12.5),
      fontWeight: 700,
      textTransform: "uppercase",
      marginBottom: 9,
      letterSpacing: 0.2,
    },
    section: { marginBottom: 16 },

    /* Work experience */
    entry: { marginBottom: 14 },
    entryRow: { flexDirection: "row" },
    dateCol: { width: DATE_COL, paddingRight: 6, color: MUTED, fontSize: size(8.3) },
    entryBody: { flex: 1 },
    entryTitle: { fontWeight: 600 },
    entryCompany: { marginBottom: 2 },
    entryHeading: { flexDirection: "row", alignItems: "center" },
    entryHeadingText: { flex: 1 },
    logo: { width: size(logoSize), height: size(logoSize), objectFit: "contain", marginRight: 6, marginBottom: 2 },

    /* Formatted text */
    bullet: { flexDirection: "row", marginBottom: 1 },
    bulletDot: { width: size(10), paddingLeft: 2 },
    richText: { flex: 1 },
    richParagraph: { marginBottom: 2 },
    emptyLine: { height: fontSize * lineHeight * 0.6 },

    /* Sidebar */
    contactList: { paddingHorizontal: SIDE_PAD_X, marginBottom: 12 },
    contactRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 },
    contactIcon: { width: 16 },
    contactText: { flex: 1, fontSize },
    contactLink: { color: LINK, textDecoration: "none" },

    sideHeadingBand: {
      backgroundColor: SIDEBAR_HEAD_BG,
      paddingVertical: 11,
      paddingHorizontal: SIDE_PAD_X,
      marginBottom: 14,
    },
    sideHeadingNotch: { position: "absolute", bottom: -6, left: SIDE_PAD_X + 2 },
    sideHeading: { fontSize: size(12.5), fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.2 },

    skillGroup: { paddingHorizontal: SIDE_PAD_X, marginBottom: 14 },
    skillName: { fontSize, marginBottom: 3 },
    skillList: { marginTop: 5 },
    languageLevel: { marginTop: 3, fontSize: size(8.2), color: MUTED },

    sideSummary: { marginTop: 4 },
    sideSummaryText: { paddingHorizontal: SIDE_PAD_X, fontSize },

    /* ----- Minimal (one column, ATS-first) layout ----- */
    mPage: {
      fontFamily,
      fontSize,
      lineHeight,
      color: INK,
      paddingTop: 40,
      paddingBottom: 40,
      paddingHorizontal: 44,
    },
    mHeader: { marginBottom: 14, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
    mName: { fontSize: size(24), fontWeight: 700, lineHeight: 1.15, color: accentColor },
    mTitle: { fontSize: size(12), lineHeight: 1.3, marginTop: 2 },
    mContact: { marginTop: 6, color: MUTED },
    mContactLink: { color: MUTED, textDecoration: "none" },
    mSection: { marginBottom: 12 },
    mHeading: {
      fontSize: size(10.5),
      fontWeight: 700,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      color: accentColor,
      paddingBottom: 3,
      marginBottom: 6,
      borderBottomWidth: 0.75,
      borderBottomColor: "#E5E7EB",
    },
    mEntry: { marginBottom: 10 },
    mEntryHead: { flexDirection: "row", alignItems: "center", marginBottom: 2 },
    mEntryHeadText: { flex: 1 },
    mDates: { color: MUTED, fontSize: size(8.3), marginLeft: 8, textAlign: "right" },
    mLine: { marginBottom: 2 },
  });

  return { s, size, accentColor, accentFaded };
}

type Theme = ReturnType<typeof makeTheme>;
const ThemeContext = createContext<Theme>(makeTheme(undefined));
const useTheme = () => useContext(ThemeContext);

/* ---------- Small helpers ---------- */

const clean = (value: string | undefined | null) => (value ?? "").trim();
const nonEmpty = (list: { value?: string }[] | undefined) =>
  (list ?? []).map((item) => clean(item?.value)).filter(Boolean);

/** Downward-pointing triangle used for the little "notch" details. */
function Notch({ color, style }: { color: string; style: ComponentProps<typeof Svg>["style"] }) {
  return (
    <Svg width={14} height={7} style={style}>
      <Polygon points="0,0 14,0 7,7" fill={color} />
    </Svg>
  );
}

/** A plain-text bullet (used for the skills list in the sidebar). */
function Bullet({ text, size }: { text: string; size?: number }) {
  const { s } = useTheme();
  const sized = size ? { fontSize: size } : {};
  return (
    // wrap={false}: a bullet is never split across two pages.
    <View style={s.bullet} wrap={false}>
      <Text style={[s.bulletDot, sized]}>•</Text>
      <Text style={[s.richText, sized]}>{text}</Text>
    </View>
  );
}

/* ---------- Formatted text (bold / italic / underline / lists / alignment) ---------- */

/** Text runs with their bold/italic/underline marks, as nested <Text>. */
function Inlines({ inlines }: { inlines: RichInline[] }) {
  return (
    <>
      {inlines.map((node, i) => {
        if (node.type === "hardBreak") return "\n";
        const marks = new Set((node.marks ?? []).map((m) => m.type));
        const style: { fontWeight?: number; fontStyle?: "italic"; textDecoration?: "underline" } = {};
        if (marks.has("bold")) style.fontWeight = 700;
        if (marks.has("italic")) style.fontStyle = "italic";
        if (marks.has("underline")) style.textDecoration = "underline";
        return (
          <Text key={i} style={style}>
            {node.text}
          </Text>
        );
      })}
    </>
  );
}

/** One paragraph or one bullet of formatted text. */
function RichUnitView({ unit }: { unit: RichUnit }) {
  const { s, size } = useTheme();
  const hasText = unit.inlines.some((i) => i.type === "text" && i.text.trim() !== "");
  if (unit.kind === "bullet") {
    return (
      // wrap={false}: a bullet is never split across two pages.
      <View style={[s.bullet, { paddingLeft: unit.depth * size(10) }]} wrap={false}>
        <Text style={s.bulletDot}>{unit.depth > 0 ? "–" : "•"}</Text>
        <Text style={[s.richText, { textAlign: unit.align }]}>
          <Inlines inlines={unit.inlines} />
        </Text>
      </View>
    );
  }
  if (!hasText) return <View style={s.emptyLine} />;
  // Paragraphs may continue on the next page, but never leave a single line behind.
  return (
    <Text style={[s.richParagraph, { textAlign: unit.align }]} orphans={2} widows={2}>
      <Inlines inlines={unit.inlines} />
    </Text>
  );
}

/** 10 slanted segments; the first `rating` are solid accent colour. */
function RatingBar({ rating }: { rating: number }) {
  const { accentColor, accentFaded } = useTheme();
  const count = 10;
  const gap = 2.5;
  const height = 8;
  const skew = 2.5;
  const segment = (RATING_BAR_WIDTH - gap * (count - 1)) / count;
  const filled = Math.max(0, Math.min(count, Math.round(Number(rating) || 0)));
  return (
    <Svg width={RATING_BAR_WIDTH} height={height}>
      {Array.from({ length: count }, (_, i) => {
        const x = i * (segment + gap);
        const points = `${x + skew},0 ${x + segment},0 ${x + segment - skew},${height} ${x},${height}`;
        return <Polygon key={i} points={points} fill={i < filled ? accentColor : accentFaded} />;
      })}
    </Svg>
  );
}

function SectionHeading({ children }: { children: string }) {
  const { s } = useTheme();
  // minPresenceAhead: if less than ~50pt of content would follow the heading
  // on this page, move the heading to the next page (no orphan headings).
  return (
    <Text style={s.sectionHeading} minPresenceAhead={50}>
      {children}
    </Text>
  );
}

function SidebarHeading({ children }: { children: string }) {
  const { s } = useTheme();
  return (
    <View style={s.sideHeadingBand} minPresenceAhead={50}>
      <Text style={s.sideHeading}>{children}</Text>
      <Notch color={SIDEBAR_HEAD_BG} style={s.sideHeadingNotch} />
    </View>
  );
}

/* ---------- Sections ---------- */

function DateRange({ job }: { job: Experience }) {
  const { s } = useTheme();
  const start = clean(job.startDate);
  const end = job.isCurrent ? "Present" : clean(job.endDate);
  if (!start && !end) return <View style={s.dateCol} />;
  return (
    <View style={s.dateCol}>
      <Text>{start}</Text>
      <Text>-</Text>
      <Text>{end}</Text>
    </View>
  );
}

function ExperienceEntry({ job }: { job: Experience }) {
  const { s } = useTheme();
  const [first, ...rest] = flattenDoc(job.description);
  return (
    <View style={s.entry}>
      {/* Dates + title + company + first line of the description stay together on one page. */}
      <View style={s.entryRow} wrap={false}>
        <DateRange job={job} />
        <View style={s.entryBody}>
          <View style={s.entryHeading}>
            {/* Company logo thumbnail, only when one was uploaded. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's <Image> is not an HTML <img> and has no alt prop */}
            {job.logo ? <Image src={job.logo} style={s.logo} /> : null}
            <View style={s.entryHeadingText}>
              {clean(job.jobTitle) && <Text style={s.entryTitle}>{clean(job.jobTitle)}</Text>}
              {clean(job.company) && <Text style={s.entryCompany}>{clean(job.company)}</Text>}
            </View>
          </View>
          {first && <RichUnitView unit={first} />}
        </View>
      </View>
      {rest.map((unit, i) => (
        <View key={i} style={s.entryRow}>
          <View style={{ width: DATE_COL }} />
          <View style={s.entryBody}>
            <RichUnitView unit={unit} />
          </View>
        </View>
      ))}
    </View>
  );
}

function Contacts({ personal }: { personal: ResumeData["personal"] }) {
  const { s } = useTheme();
  const location = clean(personal?.location);
  const phone = clean(personal?.phone);
  const email = clean(personal?.email);
  const website = clean(personal?.website);
  const websiteHref = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  if (!location && !phone && !email && !website) return null;
  return (
    <View style={s.contactList}>
      {location && (
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <PinIcon background={SIDEBAR_BG} />
          </View>
          <Text style={s.contactText}>{location}</Text>
        </View>
      )}
      {phone && (
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <PhoneIcon />
          </View>
          <Link src={`tel:${phone.replace(/[^\d+]/g, "")}`} style={[s.contactText, { color: INK, textDecoration: "none" }]}>
            {phone}
          </Link>
        </View>
      )}
      {email && (
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <MailIcon />
          </View>
          <Link src={`mailto:${email}`} style={[s.contactText, s.contactLink]}>
            {email}
          </Link>
        </View>
      )}
      {website && (
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <GlobeIcon />
          </View>
          <Link src={websiteHref} style={[s.contactText, s.contactLink]}>
            {website.replace(/^https?:\/\//i, "")}
          </Link>
        </View>
      )}
    </View>
  );
}

function SkillGroupBlock({ group }: { group: SkillGroup }) {
  const { s, size } = useTheme();
  const skills = nonEmpty(group.skills);
  return (
    <View style={s.skillGroup} wrap={false}>
      {clean(group.name) && <Text style={s.skillName}>{clean(group.name)}</Text>}
      <RatingBar rating={group.rating} />
      {skills.length > 0 && (
        <View style={s.skillList}>
          {skills.map((skill, i) => (
            <Bullet key={i} text={skill} size={size(8.2)} />
          ))}
        </View>
      )}
    </View>
  );
}

/** A language: name, a bar matching the skills style, and the level in words. */
function LanguageBlock({ language }: { language: Language }) {
  const { s } = useTheme();
  const level = languageLevelInfo(language.level);
  return (
    <View style={s.skillGroup} wrap={false}>
      <Text style={s.skillName}>{clean(language.name)}</Text>
      <RatingBar rating={level.bar} />
      <Text style={s.languageLevel}>{level.label}</Text>
    </View>
  );
}

/* ---------- Minimal (one column, ATS-first) ---------- */

function MinimalHeading({ children }: { children: string }) {
  const { s } = useTheme();
  return (
    <Text style={s.mHeading} minPresenceAhead={40}>
      {children}
    </Text>
  );
}

function MinimalExperience({ job }: { job: Experience }) {
  const { s } = useTheme();
  const [first, ...rest] = flattenDoc(job.description);
  const start = clean(job.startDate);
  const end = job.isCurrent ? "Present" : clean(job.endDate);
  const dates = [start, end].filter(Boolean).join(" - ");
  const company = clean(job.company);
  return (
    <View style={s.mEntry}>
      {/* Title line + first line of the description stay together on one page. */}
      <View wrap={false}>
        <View style={s.mEntryHead}>
          {/* eslint-disable-next-line jsx-a11y/alt-text -- react-pdf's <Image> is not an HTML <img> and has no alt prop */}
          {job.logo ? <Image src={job.logo} style={s.logo} /> : null}
          <Text style={s.mEntryHeadText}>
            <Text style={s.entryTitle}>{clean(job.jobTitle)}</Text>
            {company ? `, ${company}` : ""}
          </Text>
          {dates ? <Text style={s.mDates}>{dates}</Text> : null}
        </View>
        {first && <RichUnitView unit={first} />}
      </View>
      {rest.map((unit, i) => (
        <RichUnitView key={i} unit={unit} />
      ))}
    </View>
  );
}

function MinimalPage({ data }: { data: ResumeData }) {
  const { s } = useTheme();
  const personal = data.personal ?? ({} as ResumeData["personal"]);
  const summary = flattenDoc(data.summary);
  const experience = sortExperience((data.experience ?? []).filter(Boolean), data.experienceOrder ?? "newest");
  const education = (data.education ?? []).filter((e) => e && (clean(e.degree) || clean(e.institution) || clean(e.year)));
  const skillGroups = (data.skillGroups ?? []).filter((g) => g && (clean(g.name) || nonEmpty(g.skills).length));
  const languages = (data.languages ?? []).filter((l) => l && clean(l.name));
  const highlights = clean(data.sidebarSummary);

  const email = clean(personal.email);
  const website = clean(personal.website);
  const contact: { text: string; href?: string }[] = [
    { text: clean(personal.location) },
    { text: clean(personal.phone) },
    { text: email, href: email ? `mailto:${email}` : undefined },
    {
      text: website.replace(/^https?:\/\//i, ""),
      href: website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : undefined,
    },
  ].filter((c) => c.text);

  return (
    <Page size="A4" style={s.mPage}>
      <View style={s.mHeader}>
        <Text style={s.mName}>{clean(personal.fullName) || "Your Name"}</Text>
        {clean(personal.jobTitle) ? <Text style={s.mTitle}>{clean(personal.jobTitle)}</Text> : null}
        {contact.length > 0 && (
          // One <Text> for the whole line, so the spaces around "|" are kept.
          <Text style={s.mContact}>
            {contact.map((c, i) => (
              <Fragment key={i}>
                {i > 0 ? "   |   " : ""}
                {c.href ? (
                  <Link src={c.href} style={s.mContactLink}>
                    {c.text}
                  </Link>
                ) : (
                  c.text
                )}
              </Fragment>
            ))}
          </Text>
        )}
      </View>

      {summary.length > 0 && (
        <View style={s.mSection}>
          <MinimalHeading>Summary</MinimalHeading>
          {summary.map((unit, i) => (
            <RichUnitView key={i} unit={unit} />
          ))}
        </View>
      )}

      {highlights ? (
        <View style={s.mSection} wrap={false}>
          <MinimalHeading>Highlights</MinimalHeading>
          <Text>{highlights}</Text>
        </View>
      ) : null}

      {experience.length > 0 && (
        <View style={s.mSection}>
          <MinimalHeading>Work Experience</MinimalHeading>
          {experience.map((job, i) => (
            <MinimalExperience key={i} job={job} />
          ))}
        </View>
      )}

      {education.length > 0 && (
        <View style={s.mSection}>
          <MinimalHeading>Education</MinimalHeading>
          {education.map((item, i) => (
            <View key={i} style={[s.mEntryHead, { alignItems: "flex-start", marginBottom: 4 }]} wrap={false}>
              <View style={s.mEntryHeadText}>
                {clean(item.degree) ? <Text style={s.entryTitle}>{clean(item.degree)}</Text> : null}
                {clean(item.institution) ? <Text>{clean(item.institution)}</Text> : null}
              </View>
              {clean(item.year) ? <Text style={s.mDates}>{clean(item.year)}</Text> : null}
            </View>
          ))}
        </View>
      )}

      {skillGroups.length > 0 && (
        <View style={s.mSection}>
          <MinimalHeading>Skills</MinimalHeading>
          {skillGroups.map((group, i) => {
            const skills = nonEmpty(group.skills);
            return (
              <Text key={i} style={s.mLine}>
                {clean(group.name) ? <Text style={s.entryTitle}>{clean(group.name)}{skills.length ? ": " : ""}</Text> : null}
                {skills.join(", ")}
              </Text>
            );
          })}
        </View>
      )}

      {languages.length > 0 && (
        <View style={s.mSection} wrap={false}>
          <MinimalHeading>Languages</MinimalHeading>
          <Text>{languages.map((l) => `${clean(l.name)} (${languageLevelInfo(l.level).label})`).join(", ")}</Text>
        </View>
      )}
    </Page>
  );
}

/* ---------- The document ---------- */

export function ResumeDocument({ data }: { data: ResumeData }) {
  const theme = makeTheme(data.style);
  const { s } = theme;
  const personal = data.personal ?? ({} as ResumeData["personal"]);
  const fullName = clean(personal.fullName);
  // Always in date order, whatever order the form currently shows.
  const experience = sortExperience((data.experience ?? []).filter(Boolean), data.experienceOrder ?? "newest");
  const languages = (data.languages ?? []).filter((l) => l && clean(l.name));
  const education = (data.education ?? []).filter(
    (e) => e && (clean(e.degree) || clean(e.institution) || clean(e.year)),
  );
  const skillGroups = (data.skillGroups ?? []).filter(Boolean);
  const summary = flattenDoc(data.summary);
  const sidebarSummary = clean(data.sidebarSummary);
  const isMinimal = templateInfo(data.style?.template).layout === "minimal";

  return (
    <ThemeContext.Provider value={theme}>
      <Document
        title={fullName ? `${fullName} - Resume` : "Resume"}
        author={fullName || undefined}
        subject={clean(personal.jobTitle) || undefined}
        creator="Resume Builder"
        producer="Resume Builder"
      >
        {isMinimal ? (
          <MinimalPage data={data} />
        ) : (
        <Page size="A4" style={s.page}>
          <View style={s.sidebarBackground} fixed />

          {/* Header: name + accent block, then the grey job-title strip */}
          <View style={s.header}>
            <View style={s.nameRow}>
              <View style={s.nameBox}>
                <Text style={s.name}>{fullName || "Your Name"}</Text>
              </View>
              <View style={s.accentBlock} />
            </View>
            <View style={s.strip}>
              <Notch color="#FFFFFF" style={s.stripNotch} />
              <Text style={s.jobTitle}>{clean(personal.jobTitle) || " "}</Text>
            </View>
          </View>

          <View style={s.body}>
            {/* Left / main column */}
            <View style={s.main}>
              {summary.length > 0 && (
                <View style={s.section}>
                  <SectionHeading>Summary</SectionHeading>
                  {summary.map((unit, i) => (
                    <RichUnitView key={i} unit={unit} />
                  ))}
                </View>
              )}

              {experience.length > 0 && (
                <View style={s.section}>
                  <SectionHeading>Work Experience</SectionHeading>
                  {experience.map((job, i) => (
                    <ExperienceEntry key={i} job={job} />
                  ))}
                </View>
              )}

              {education.length > 0 && (
                <View style={s.section}>
                  <SectionHeading>Education</SectionHeading>
                  {education.map((item, i) => (
                    <View key={i} style={[s.entryRow, { marginBottom: 8 }]} wrap={false}>
                      <Text style={s.dateCol}>{clean(item.year)}</Text>
                      <View style={s.entryBody}>
                        {clean(item.degree) && <Text style={s.entryTitle}>{clean(item.degree)}</Text>}
                        {clean(item.institution) && <Text>{clean(item.institution)}</Text>}
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Right sidebar */}
            <View style={s.sidebar}>
              <Contacts personal={personal} />

              {skillGroups.length > 0 && (
                <View>
                  <SidebarHeading>Skills</SidebarHeading>
                  {skillGroups.map((group, i) => (
                    <SkillGroupBlock key={i} group={group} />
                  ))}
                </View>
              )}

              {languages.length > 0 && (
                <View>
                  <SidebarHeading>Languages</SidebarHeading>
                  {languages.map((language, i) => (
                    <LanguageBlock key={i} language={language} />
                  ))}
                </View>
              )}

              {sidebarSummary && (
                <View style={s.sideSummary} wrap={false}>
                  <SidebarHeading>Summary</SidebarHeading>
                  <Text style={s.sideSummaryText}>{sidebarSummary}</Text>
                </View>
              )}
            </View>
          </View>
        </Page>
        )}
      </Document>
    </ThemeContext.Provider>
  );
}
