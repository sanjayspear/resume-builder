import { Document, Image, Link, Page, Polygon, StyleSheet, Svg, Text, View } from "@react-pdf/renderer";
import { createContext, useContext, type ComponentProps } from "react";
import { sortExperience } from "@/lib/experienceSort";
import { languageLevelInfo } from "@/lib/languages";
import { templateInfo } from "@/lib/templates";
import { flattenDoc, type RichUnit } from "@/lib/richText";
import {
  isBlankExperience,
  isBlankSkillGroup,
  type Certification,
  type Experience,
  type Language,
  type Project,
  type ResumeData,
  type SkillGroup,
} from "@/lib/schema";
import { DEFAULT_FONT_SIZE, normalizeStyle, tint } from "@/lib/theme";
import { GlobeIcon, LinkedInIcon, MailIcon, PhoneIcon, PinIcon } from "./icons";
import { ModernAtsDocument } from "./ModernAtsDocument";
import { PLACEHOLDER } from "./placeholders";
import { clean, displayUrl, documentInfo, Inlines, NO_LIGATURES, nonEmpty, webHref } from "./shared";

/*
 * The PDF for a resume. Classic Sidebar is drawn in this file; Modern ATS
 * lives in ModernAtsDocument.tsx. Both read the same ResumeData.
 *
 * `placeholders`: draw grey hint text (placeholders.ts) where fields are
 * empty. Only the on-screen preview turns this on; downloads never do.
 */

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
      fontFeatureSettings: NO_LIGATURES,
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
  });

  return { s, size, accentColor, accentFaded };
}

type Theme = ReturnType<typeof makeTheme>;
const ThemeContext = createContext<Theme>(makeTheme(undefined));
const useTheme = () => useContext(ThemeContext);

/* ---------- Small helpers ---------- */

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
              {clean(job.company) && (
                <Text style={s.entryCompany}>
                  {[clean(job.company), clean(job.location)].filter(Boolean).join(", ")}
                </Text>
              )}
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

/** A project: name (and link), then its description. Only shown when projects exist. */
function ProjectEntry({ project }: { project: Project }) {
  const { s } = useTheme();
  const [first, ...rest] = flattenDoc(project.description);
  const link = clean(project.link);
  return (
    <View style={s.entry}>
      <View style={s.entryRow} wrap={false}>
        <View style={{ width: DATE_COL }} />
        <View style={s.entryBody}>
          <Text style={s.entryCompany}>
            <Text style={s.entryTitle}>{clean(project.name)}</Text>
            {link ? "   " : ""}
            {link ? (
              <Link src={webHref(link)} style={s.contactLink}>
                {displayUrl(link)}
              </Link>
            ) : null}
          </Text>
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

/** A certification, laid out like an education entry (year on the left). */
function CertificationEntry({ item }: { item: Certification }) {
  const { s } = useTheme();
  return (
    <View style={[s.entryRow, { marginBottom: 8 }]} wrap={false}>
      <Text style={s.dateCol}>{clean(item.year)}</Text>
      <View style={s.entryBody}>
        <Text style={s.entryTitle}>{clean(item.name)}</Text>
        {clean(item.issuer) && <Text>{clean(item.issuer)}</Text>}
      </View>
    </View>
  );
}

function Contacts({ personal, placeholders }: { personal: ResumeData["personal"]; placeholders: boolean }) {
  const { s } = useTheme();
  const location = clean(personal?.location);
  const phone = clean(personal?.phone);
  const email = clean(personal?.email);
  const website = clean(personal?.website);
  const websiteHref = /^https?:\/\//i.test(website) ? website : `https://${website}`;
  const linkedin = clean(personal?.linkedin);
  if (!location && !phone && !email && !website && !linkedin) {
    if (!placeholders) return null;
    const hint = [s.contactText, { color: PLACEHOLDER.color }];
    return (
      <View style={s.contactList}>
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <PinIcon background={SIDEBAR_BG} />
          </View>
          <Text style={hint}>{PLACEHOLDER.location}</Text>
        </View>
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <PhoneIcon />
          </View>
          <Text style={hint}>{PLACEHOLDER.phone}</Text>
        </View>
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <MailIcon />
          </View>
          <Text style={hint}>{PLACEHOLDER.email}</Text>
        </View>
      </View>
    );
  }
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
      {linkedin && (
        <View style={s.contactRow}>
          <View style={s.contactIcon}>
            <LinkedInIcon background={SIDEBAR_BG} />
          </View>
          <Link src={webHref(linkedin)} style={[s.contactText, s.contactLink]}>
            {displayUrl(linkedin)}
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

/* ---------- The document ---------- */

export function ResumeDocument({ data, placeholders = false }: { data: ResumeData; placeholders?: boolean }) {
  if (templateInfo(data.style?.template).layout === "ats") {
    return <ModernAtsDocument data={data} placeholders={placeholders} />;
  }
  return <ClassicSidebarDocument data={data} placeholders={placeholders} />;
}

/* ---------- Classic Sidebar ---------- */

function ClassicSidebarDocument({ data, placeholders }: { data: ResumeData; placeholders: boolean }) {
  const theme = makeTheme(data.style);
  const { s } = theme;
  const personal = data.personal ?? ({} as ResumeData["personal"]);
  const fullName = clean(personal.fullName);
  // Always in date order, whatever order the form currently shows.
  // Completely empty entries (e.g. left by "Clear form") are skipped.
  const experience = sortExperience(
    (data.experience ?? []).filter((job) => job && !isBlankExperience(job)),
    data.experienceOrder ?? "newest",
  );
  const languages = (data.languages ?? []).filter((l) => l && clean(l.name));
  const education = (data.education ?? []).filter(
    (e) => e && (clean(e.degree) || clean(e.institution) || clean(e.year)),
  );
  const skillGroups = (data.skillGroups ?? []).filter((group) => group && !isBlankSkillGroup(group));
  const summary = flattenDoc(data.summary);
  const hasSummary = summary.some((u) => u.inlines.some((i) => i.type === "text" && i.text.trim() !== ""));
  const hint = { color: PLACEHOLDER.color };
  const sidebarSummary = clean(data.sidebarSummary);
  // Optional sections: only drawn when they have content.
  const projects = (data.projects ?? []).filter((p) => p && clean(p.name));
  const certifications = (data.certifications ?? []).filter((c) => c && clean(c.name));

  return (
    <ThemeContext.Provider value={theme}>
      <Document {...documentInfo(personal)}>
        <Page size="A4" style={s.page}>
          <View style={s.sidebarBackground} fixed />

          {/* Header: name + accent block, then the grey job-title strip */}
          <View style={s.header}>
            <View style={s.nameRow}>
              <View style={s.nameBox}>
                {fullName ? (
                  <Text style={s.name}>{fullName}</Text>
                ) : (
                  <Text style={[s.name, placeholders ? hint : {}]}>{placeholders ? PLACEHOLDER.name : " "}</Text>
                )}
              </View>
              <View style={s.accentBlock} />
            </View>
            <View style={s.strip}>
              <Notch color="#FFFFFF" style={s.stripNotch} />
              {clean(personal.jobTitle) || !placeholders ? (
                <Text style={s.jobTitle}>{clean(personal.jobTitle) || " "}</Text>
              ) : (
                <Text style={[s.jobTitle, hint]}>{PLACEHOLDER.jobTitle}</Text>
              )}
            </View>
          </View>

          <View style={s.body}>
            {/* Left / main column */}
            <View style={s.main}>
              {hasSummary ? (
                <View style={s.section}>
                  <SectionHeading>Summary</SectionHeading>
                  {summary.map((unit, i) => (
                    <RichUnitView key={i} unit={unit} />
                  ))}
                </View>
              ) : (
                placeholders && (
                  <View style={s.section}>
                    <SectionHeading>Summary</SectionHeading>
                    <Text style={[s.richParagraph, hint]}>{PLACEHOLDER.summary}</Text>
                  </View>
                )
              )}

              {experience.length > 0 ? (
                <View style={s.section}>
                  <SectionHeading>Work Experience</SectionHeading>
                  {experience.map((job, i) => (
                    <ExperienceEntry key={i} job={job} />
                  ))}
                </View>
              ) : (
                placeholders && (
                  <View style={s.section}>
                    <SectionHeading>Work Experience</SectionHeading>
                    <View style={s.entryRow}>
                      <Text style={[s.dateCol, hint]}>{PLACEHOLDER.dates}</Text>
                      <View style={s.entryBody}>
                        <Text style={[s.entryTitle, hint]}>{PLACEHOLDER.experienceTitle}</Text>
                        <Text style={[s.entryCompany, hint]}>{PLACEHOLDER.company}</Text>
                        <View style={s.bullet}>
                          <Text style={[s.bulletDot, hint]}>•</Text>
                          <Text style={[s.richText, hint]}>{PLACEHOLDER.bullet}</Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )
              )}

              {projects.length > 0 && (
                <View style={s.section}>
                  <SectionHeading>Projects</SectionHeading>
                  {projects.map((project, i) => (
                    <ProjectEntry key={i} project={project} />
                  ))}
                </View>
              )}

              {education.length > 0 ? (
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
              ) : (
                placeholders && (
                  <View style={s.section}>
                    <SectionHeading>Education</SectionHeading>
                    <View style={s.entryRow}>
                      <Text style={[s.dateCol, hint]}>{PLACEHOLDER.year}</Text>
                      <View style={s.entryBody}>
                        <Text style={[s.entryTitle, hint]}>{PLACEHOLDER.degree}</Text>
                        <Text style={hint}>{PLACEHOLDER.institution}</Text>
                      </View>
                    </View>
                  </View>
                )
              )}

              {certifications.length > 0 && (
                <View style={s.section}>
                  <SectionHeading>Certifications</SectionHeading>
                  {certifications.map((item, i) => (
                    <CertificationEntry key={i} item={item} />
                  ))}
                </View>
              )}
            </View>

            {/* Right sidebar */}
            <View style={s.sidebar}>
              <Contacts personal={personal} placeholders={placeholders} />

              {skillGroups.length > 0 ? (
                <View>
                  <SidebarHeading>Skills</SidebarHeading>
                  {skillGroups.map((group, i) => (
                    <SkillGroupBlock key={i} group={group} />
                  ))}
                </View>
              ) : (
                placeholders && (
                  <View>
                    <SidebarHeading>Skills</SidebarHeading>
                    <View style={s.skillGroup}>
                      <Text style={[s.skillName, hint]}>{PLACEHOLDER.skillGroup}</Text>
                      <Text style={[s.languageLevel, hint]}>{PLACEHOLDER.skills}</Text>
                    </View>
                  </View>
                )
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
      </Document>
    </ThemeContext.Provider>
  );
}
