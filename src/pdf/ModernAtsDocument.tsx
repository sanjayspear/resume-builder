import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { createContext, Fragment, useContext, type ReactNode } from "react";
import { sortExperience } from "@/lib/experienceSort";
import { languageLevelInfo } from "@/lib/languages";
import { splitMetrics } from "@/lib/metrics";
import { flattenDoc, type RichDoc, type RichInline, type RichUnit } from "@/lib/richText";
import { isBlankExperience, type Certification, type Education, type Experience, type Project, type ResumeData } from "@/lib/schema";
import { normalizeStyle, tint, type AtsHeaderStyle } from "@/lib/theme";
import { DISPLAY_FONT } from "./fonts";
import { PLACEHOLDER } from "./placeholders";
import { clean, displayUrl, documentInfo, Inlines, NO_LIGATURES, nonEmpty, webHref } from "./shared";

/*
 * Modern ATS: a one-column resume that resume scanners (ATS) read perfectly,
 * styled only with things that can't confuse them: colour, weight and spacing.
 *
 * ATS rules this layout follows on purpose:
 * - One column, drawn top to bottom, so the text order in the PDF is the
 *   reading order (no sidebars, tables or text boxes).
 * - Only real text: no images, icons, logos or rating bars.
 * - Standard section headings in a standard order.
 * - Fixed typography (Inter 10 pt body, Montserrat for the name and
 *   headings); the Design panel's font and size options are Classic's.
 * - Decoration (the Banner band, accent bars, divider lines) is drawn as
 *   plain shapes BEHIND or BESIDE real text, never as text in pictures, and
 *   never changes the text or its order. Bold metrics only change weight.
 */

/* ---------- Design tokens ---------- */

const FONT = "Inter";
const BODY_SIZE = 10;
const LINE_HEIGHT = 1.35;
const MARGIN_X = 47; // 0.65 inch (72 pt = 1 inch)
const MARGIN_Y = 43; // 0.6 inch
const INK = "#1F2328"; // body text
const STRONG = "#111827"; // job titles
const MUTED = "#5B6472"; // job title under the name, dates, separators
const RULE = "#D5DAE1"; // thin line under section headings
const SEPARATOR = "#B3BAC4"; // the lighter "|" between contact details
const WHITE = "#FFFFFF";
const DISPLAY = DISPLAY_FONT; // Montserrat: name and section headings

/*
 * Body text: no ligatures (see shared.tsx) and no kerning. Inter's kerning
 * tucks a full stop under a 7, so "97.1%" looked like "971%" and some
 * extractors split it. Without kerning every character keeps its own width.
 * The big Montserrat name and headings keep kerning (it looks better there).
 */
const BODY_FEATURES = { ...NO_LIGATURES, kern: false };
const DISPLAY_FEATURES = NO_LIGATURES;

function makeStyles(accent: string) {
  const displayName = {
    fontFamily: DISPLAY,
    fontFeatureSettings: DISPLAY_FEATURES,
    fontWeight: 700,
    fontSize: 30,
    lineHeight: 1.12,
    letterSpacing: -0.2,
  } as const;
  return StyleSheet.create({
    page: {
      fontFamily: FONT,
      fontFeatureSettings: BODY_FEATURES,
      fontSize: BODY_SIZE,
      lineHeight: LINE_HEIGHT,
      color: INK,
      paddingTop: MARGIN_Y,
      paddingBottom: MARGIN_Y,
      paddingHorizontal: MARGIN_X,
    },

    /* Header: Minimal (the original design) */
    header: { paddingBottom: 11, marginBottom: 18, borderBottomWidth: 1.25, borderBottomColor: accent },
    name: { fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: accent, letterSpacing: -0.3 },
    title: { fontSize: 12.5, lineHeight: 1.25, color: MUTED, marginTop: 4 },
    contact: { fontSize: 9.5, marginTop: 8 },
    contactLink: { color: INK, textDecoration: "none" },
    separator: { color: SEPARATOR },

    /* Header: Banner. Negative margins make the band reach the page edges. */
    banner: {
      backgroundColor: accent,
      marginTop: -MARGIN_Y,
      marginHorizontal: -MARGIN_X,
      paddingTop: 34,
      paddingBottom: 24,
      paddingHorizontal: MARGIN_X,
      marginBottom: 22,
      alignItems: "center",
    },
    bannerName: { ...displayName, color: WHITE, textAlign: "center" },
    bannerTitle: { fontSize: 13, lineHeight: 1.25, color: WHITE, marginTop: 5, textAlign: "center" },
    bannerContact: { fontSize: 9.5, color: WHITE, marginTop: 10, textAlign: "center" },
    bannerLink: { color: WHITE, textDecoration: "none" },
    bannerSeparator: { color: tint(accent, 0.55) }, // lighter shade of the band
    bannerHint: { color: tint(accent, 0.6) }, // preview placeholders on the band

    /* Header: Left accent */
    accentHeader: {
      flexDirection: "row",
      marginBottom: 20,
      paddingBottom: 14,
      borderBottomWidth: 0.75,
      borderBottomColor: RULE,
    },
    accentBar: { width: 6, backgroundColor: accent, marginRight: 14 },
    accentHeaderText: { flex: 1 },
    accentName: { ...displayName, color: accent },

    /*
     * Spacing below blocks uses padding, not margin: react-pdf moves a block
     * that fits but whose bottom MARGIN doesn't to the next page as a whole
     * (leaving a gap), while bottom padding is simply dropped at a page break.
     */
    /* Sections */
    section: { paddingBottom: 18 },
    headingBar: { width: 28, height: 3, backgroundColor: accent, marginBottom: 6 },
    heading: {
      fontFamily: DISPLAY,
      fontFeatureSettings: DISPLAY_FEATURES,
      fontSize: 11.5,
      fontWeight: 700,
      lineHeight: 1.2,
      textTransform: "uppercase",
      // Keep well under 0.1 em (1.15 pt here): wider gaps make text extractors
      // (and ATS) read "S U M M A R Y" as separate letters. Tests check this.
      letterSpacing: 0.6,
      color: accent,
      paddingBottom: 4,
      marginBottom: 8,
      borderBottomWidth: 0.75,
      borderBottomColor: RULE,
    },

    /* Entries (jobs, projects, education, certifications) */
    entry: { paddingBottom: 11 },
    simpleEntry: { paddingBottom: 5 },
    lastEntry: { paddingBottom: 0 }, // the section's own padding follows
    entryHead: { flexDirection: "row", alignItems: "flex-start", paddingBottom: 2 },
    entryHeadText: { flex: 1, paddingRight: 12 },
    projectHead: { paddingBottom: 2 },
    strong: { fontWeight: 700, color: STRONG },
    accentText: { fontWeight: 600, color: accent },
    // flexShrink 0: the date range keeps its full width, so it never wraps.
    dates: { flexShrink: 0, fontSize: 9.5, color: MUTED, textAlign: "right" },

    /* Text */
    paragraph: { paddingBottom: 3 },
    bullet: { flexDirection: "row", paddingBottom: 2 },
    bulletDot: { width: 11, color: accent },
    bulletText: { flex: 1 },
    line: { paddingBottom: 3 },
    emptyLine: { height: 5 },
  });
}

type Styles = ReturnType<typeof makeStyles>;
const StylesContext = createContext<Styles>(makeStyles("#1E3A5F"));
const useStyles = () => useContext(StylesContext);
/** Draw metrics (40%, $140K…) in bold? The Design panel's "Bold numbers" switch. */
const BoldMetricsContext = createContext(true);

/* ---------- Building blocks ---------- */

/** "May 2025" + "Present" -> "May 2025 – Present" (always one line, see `dates`). */
function dateRange(start: string, end: string) {
  return [clean(start), clean(end)].filter(Boolean).join(" – ");
}

/** Short accent bar, then the heading (with a thin divider line under it). */
function Heading({ children }: { children: string }) {
  const s = useStyles();
  return (
    <>
      <View style={s.headingBar} />
      <Text style={s.heading}>{children}</Text>
    </>
  );
}

/**
 * Formatted text runs, with metrics (40%, $140K…) drawn in bold when the
 * switch is on. Splitting a run only changes the weight of those
 * characters; the text an ATS reads stays exactly the same.
 */
function AtsInlines({ inlines }: { inlines: RichInline[] }) {
  const boldMetrics = useContext(BoldMetricsContext);
  const marked = inlines.flatMap((node): RichInline[] => {
    if (!boldMetrics || node.type !== "text" || node.marks?.some((m) => m.type === "bold")) return [node];
    return splitMetrics(node.text).map((part) => ({
      ...node,
      text: part.text,
      marks: part.metric ? [...(node.marks ?? []), { type: "bold" as const }] : node.marks,
    }));
  });
  return <Inlines inlines={marked} />;
}

/**
 * A section. The heading and the first item are one unbreakable block, so a
 * heading is never left alone at the bottom of a page.
 */
function Section({ title, first, rest }: { title: string; first: ReactNode; rest?: ReactNode }) {
  const s = useStyles();
  return (
    <View style={s.section}>
      <View wrap={false}>
        <Heading>{title}</Heading>
        {first}
      </View>
      {rest}
    </View>
  );
}

/** One paragraph or one "•" bullet of formatted text. */
function RichUnitView({ unit }: { unit: RichUnit }) {
  const s = useStyles();
  if (unit.kind === "bullet") {
    return (
      // wrap={false}: a bullet is never split across two pages.
      <View style={[s.bullet, { paddingLeft: unit.depth * 12 }]} wrap={false}>
        <Text style={s.bulletDot}>•</Text>
        <Text style={[s.bulletText, { textAlign: unit.align }]}>
          <AtsInlines inlines={unit.inlines} />
        </Text>
      </View>
    );
  }
  if (!unit.inlines.some((i) => i.type === "text" && i.text.trim() !== "")) return <View style={s.emptyLine} />;
  return (
    <Text style={[s.paragraph, { textAlign: unit.align }]} orphans={2} widows={2}>
      <AtsInlines inlines={unit.inlines} />
    </Text>
  );
}

/**
 * Head line of an entry: "Bold title | Accent name, rest" with the date on
 * the right. The left text comes first in the PDF, so scanners read
 * title, company, then dates.
 */
function EntryHead({ title, name, rest, dates }: { title: string; name?: string; rest?: string; dates?: string }) {
  const s = useStyles();
  return (
    <View style={s.entryHead}>
      <Text style={s.entryHeadText}>
        <Text style={s.strong}>{title}</Text>
        {name ? <Text style={s.separator}> | </Text> : null}
        {name ? <Text style={s.accentText}>{name}</Text> : null}
        {rest ? `, ${rest}` : ""}
      </Text>
      {dates ? <Text style={s.dates}>{dates}</Text> : null}
    </View>
  );
}

/**
 * An entry with a description: the head line and the first bullet stay
 * together on one page (with the section heading, for the first entry).
 */
function DescribedEntry({
  head,
  description,
  heading,
  last,
}: {
  head: ReactNode;
  description: RichDoc;
  heading?: string;
  last: boolean;
}) {
  const s = useStyles();
  const [first, ...rest] = flattenDoc(description);
  return (
    <View style={last ? s.lastEntry : s.entry}>
      <View wrap={false}>
        {heading ? <Heading>{heading}</Heading> : null}
        {head}
        {first && <RichUnitView unit={first} />}
      </View>
      {rest.map((unit, i) => (
        <RichUnitView key={i} unit={unit} />
      ))}
    </View>
  );
}

function JobEntry({ job, heading, last }: { job: Experience; heading?: string; last: boolean }) {
  const end = job.isCurrent ? "Present" : job.endDate;
  return (
    <DescribedEntry
      heading={heading}
      last={last}
      head={
        <EntryHead title={clean(job.jobTitle)} name={clean(job.company)} rest={clean(job.location)} dates={dateRange(job.startDate, end)} />
      }
      description={job.description}
    />
  );
}

function ProjectEntry({ project, heading, last }: { project: Project; heading?: string; last: boolean }) {
  const s = useStyles();
  const link = clean(project.link);
  return (
    <DescribedEntry
      heading={heading}
      last={last}
      head={
        <Text style={s.projectHead}>
          <Text style={s.strong}>{clean(project.name)}</Text>
          {link ? <Text style={s.separator}> | </Text> : null}
          {link ? (
            <Link src={webHref(link)} style={s.contactLink}>
              {displayUrl(link)}
            </Link>
          ) : null}
        </Text>
      }
      description={project.description}
    />
  );
}

function SimpleEntry({ title, name, dates, last }: { title: string; name: string; dates: string; last: boolean }) {
  const s = useStyles();
  return (
    <View style={last ? s.lastEntry : s.simpleEntry} wrap={false}>
      <EntryHead title={title} name={name} dates={dates} />
    </View>
  );
}

/** Splits a list into the first item (kept with the heading) and the rest. */
function splitSection<T>(items: T[], render: (item: T, i: number, last: boolean) => ReactNode) {
  const last = items.length - 1;
  return {
    first: render(items[0], 0, last === 0),
    rest: items.slice(1).map((item, i) => render(item, i + 1, i + 1 === last)),
  };
}

/* ---------- Header (3 styles, same text in the same order) ---------- */

type ContactItem = { text: string; href?: string };

/** location | phone | email | website | LinkedIn, as ONE text line (the " | " are real text). */
function ContactLine({
  items,
  style,
  linkStyle,
  separatorStyle,
}: {
  items: ContactItem[];
  style: Styles[keyof Styles];
  linkStyle: Styles[keyof Styles];
  separatorStyle: Styles[keyof Styles];
}) {
  return (
    <Text style={style}>
      {items.map((c, i) => (
        <Fragment key={i}>
          {i > 0 ? <Text style={separatorStyle}> | </Text> : null}
          {c.href ? (
            <Link src={c.href} style={linkStyle}>
              {c.text}
            </Link>
          ) : (
            c.text
          )}
        </Fragment>
      ))}
    </Text>
  );
}

function AtsHeader({
  variant,
  personal,
  contact,
  placeholders,
}: {
  variant: AtsHeaderStyle;
  personal: ResumeData["personal"];
  contact: ContactItem[];
  placeholders: boolean;
}) {
  const s = useStyles();
  const name = clean(personal.fullName);
  const title = clean(personal.jobTitle);
  const onBanner = variant === "banner";
  const hint = onBanner ? s.bannerHint : { color: PLACEHOLDER.color };
  const look =
    variant === "banner"
      ? { name: s.bannerName, title: s.bannerTitle, contact: s.bannerContact, link: s.bannerLink, sep: s.bannerSeparator }
      : variant === "accent"
        ? { name: s.accentName, title: s.title, contact: s.contact, link: s.contactLink, sep: s.separator }
        : { name: s.name, title: s.title, contact: s.contact, link: s.contactLink, sep: s.separator };

  const lines = (
    <>
      {name ? (
        <Text style={look.name}>{name}</Text>
      ) : (
        <Text style={[look.name, placeholders ? hint : {}]}>{placeholders ? PLACEHOLDER.name : " "}</Text>
      )}
      {title ? (
        <Text style={look.title}>{title}</Text>
      ) : placeholders ? (
        <Text style={[look.title, hint]}>{PLACEHOLDER.jobTitle}</Text>
      ) : null}
      {contact.length > 0 ? (
        <ContactLine items={contact} style={look.contact} linkStyle={look.link} separatorStyle={look.sep} />
      ) : placeholders ? (
        <Text style={[look.contact, hint]}>{[PLACEHOLDER.location, PLACEHOLDER.phone, PLACEHOLDER.email].join(" | ")}</Text>
      ) : null}
    </>
  );

  if (variant === "banner") return <View style={s.banner}>{lines}</View>;
  if (variant === "accent") {
    return (
      <View style={s.accentHeader}>
        <View style={s.accentBar} />
        <View style={s.accentHeaderText}>{lines}</View>
      </View>
    );
  }
  return <View style={s.header}>{lines}</View>;
}

/* ---------- The document ---------- */

/** `placeholders`: grey hints for empty fields; on-screen preview only (see placeholders.ts). */
export function ModernAtsDocument({ data, placeholders = false }: { data: ResumeData; placeholders?: boolean }) {
  const style = normalizeStyle(data.style);
  const s = makeStyles(style.atsAccentColor);
  const personal = data.personal ?? ({} as ResumeData["personal"]);

  const summary = flattenDoc(data.summary).filter(
    (u) => u.kind === "bullet" || u.inlines.some((i) => i.type === "text" && i.text.trim() !== ""),
  );
  const skillGroups = (data.skillGroups ?? []).filter((g) => g && (clean(g.name) || nonEmpty(g.skills).length));
  const experience = sortExperience(
    (data.experience ?? []).filter((job) => job && !isBlankExperience(job)),
    data.experienceOrder ?? "newest",
  );
  const projects = (data.projects ?? []).filter((p) => p && clean(p.name));
  const education = (data.education ?? []).filter((e): e is Education => !!e && !!(clean(e.degree) || clean(e.institution)));
  const certifications = (data.certifications ?? []).filter((c): c is Certification => !!c && !!clean(c.name));
  const languages = (data.languages ?? []).filter((l) => l && clean(l.name));
  // The sidebar summary is left out on purpose: it repeats the main summary.

  // location | phone | email | portfolio | LinkedIn, as one line of real text.
  const email = clean(personal.email);
  const website = clean(personal.website);
  const linkedin = clean(personal.linkedin);
  const contact: ContactItem[] = [
    { text: clean(personal.location) },
    { text: clean(personal.phone) },
    { text: email, href: `mailto:${email}` },
    { text: displayUrl(website), href: webHref(website) },
    { text: displayUrl(linkedin), href: webHref(linkedin) },
  ].filter((c) => c.text);
  const hint = { color: PLACEHOLDER.color };

  return (
    <StylesContext.Provider value={s}>
      <BoldMetricsContext.Provider value={style.atsBoldMetrics}>
        <Document {...documentInfo(personal)}>
          <Page size="A4" style={s.page}>
            <AtsHeader variant={style.atsHeader} personal={personal} contact={contact} placeholders={placeholders} />

            {summary.length > 0 ? (
              <Section
                title="Summary"
                {...splitSection(summary, (unit, i) => (
                  <RichUnitView key={i} unit={unit} />
                ))}
              />
            ) : (
              placeholders && <Section title="Summary" first={<Text style={[s.paragraph, hint]}>{PLACEHOLDER.summary}</Text>} />
            )}

            {skillGroups.length > 0 && (
              <Section
                title="Skills"
                {...splitSection(skillGroups, (group, i) => {
                  const skills = nonEmpty(group.skills);
                  const name = clean(group.name);
                  return (
                    // Rating bars are Classic Sidebar only; here skills are plain text.
                    <Text key={i} style={s.line}>
                      {name ? <Text style={s.strong}>{skills.length ? `${name}: ` : name}</Text> : null}
                      {skills.join(", ")}
                    </Text>
                  );
                })}
              />
            )}
            {skillGroups.length === 0 && placeholders && (
              <Section
                title="Skills"
                first={<Text style={[s.line, hint]}>{`${PLACEHOLDER.skillGroup}: ${PLACEHOLDER.skills}`}</Text>}
              />
            )}

            {experience.length === 0 && placeholders && (
              <Section
                title="Work Experience"
                first={
                  <View style={s.lastEntry}>
                    <View style={s.entryHead}>
                      <Text style={[s.entryHeadText, hint]}>{`${PLACEHOLDER.experienceTitle} | ${PLACEHOLDER.company}`}</Text>
                      <Text style={[s.dates, hint]}>{PLACEHOLDER.dates}</Text>
                    </View>
                    <View style={s.bullet}>
                      <Text style={[s.bulletDot, hint]}>•</Text>
                      <Text style={[s.bulletText, hint]}>{PLACEHOLDER.bullet}</Text>
                    </View>
                  </View>
                }
              />
            )}
            {experience.length > 0 && (
              <View style={s.section}>
                {experience.map((job, i) => (
                  <JobEntry
                    key={i}
                    job={job}
                    heading={i === 0 ? "Work Experience" : undefined}
                    last={i === experience.length - 1}
                  />
                ))}
              </View>
            )}

            {projects.length > 0 && (
              <View style={s.section}>
                {projects.map((project, i) => (
                  <ProjectEntry
                    key={i}
                    project={project}
                    heading={i === 0 ? "Projects" : undefined}
                    last={i === projects.length - 1}
                  />
                ))}
              </View>
            )}

            {education.length > 0 && (
              <Section
                title="Education"
                {...splitSection(education, (item, i, last) => (
                  <SimpleEntry
                    key={i}
                    title={clean(item.degree)}
                    name={clean(item.institution)}
                    dates={clean(item.year)}
                    last={last}
                  />
                ))}
              />
            )}

            {education.length === 0 && placeholders && (
              <Section
                title="Education"
                first={
                  <View style={s.entryHead}>
                    <Text style={[s.entryHeadText, hint]}>{`${PLACEHOLDER.degree} | ${PLACEHOLDER.institution}`}</Text>
                    <Text style={[s.dates, hint]}>{PLACEHOLDER.year}</Text>
                  </View>
                }
              />
            )}

            {certifications.length > 0 && (
              <Section
                title="Certifications"
                {...splitSection(certifications, (item, i, last) => (
                  <SimpleEntry key={i} title={clean(item.name)} name={clean(item.issuer)} dates={clean(item.year)} last={last} />
                ))}
              />
            )}

            {languages.length > 0 && (
              <Section
                title="Languages"
                first={
                  <Text>
                    {languages.map((lang, i) => (
                      <Fragment key={i}>
                        {i > 0 ? <Text style={s.separator}> | </Text> : null}
                        <Text style={s.strong}>{clean(lang.name)}</Text>
                        {` (${languageLevelInfo(lang.level).label})`}
                      </Fragment>
                    ))}
                  </Text>
                }
              />
            )}
          </Page>
        </Document>
      </BoldMetricsContext.Provider>
    </StylesContext.Provider>
  );
}
