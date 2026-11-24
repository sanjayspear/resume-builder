import { bulletsToDoc, textToDoc } from "./richText";
import type { ResumeData } from "./schema";
import { defaultStyle } from "./theme";

const items = (...values: string[]) => values.map((value) => ({ value }));

/*
 * Example content for "Load sample data" and "Start from the sample resume".
 * Maya Fernandes and Brightline Logistics are fictional; all text is original.
 * The email uses example.com and the phone a 555 number, both reserved for examples.
 */
export const sampleResume: ResumeData = {
  personal: {
    fullName: "Maya Fernandes",
    jobTitle: "Operations Manager",
    location: "Austin, TX",
    phone: "512-555-0147",
    email: "maya.fernandes@example.com",
    website: "",
    linkedin: "linkedin.com/in/maya-fernandes-sample",
  },
  summary: textToDoc(
    "Operations Manager with 6+ years of experience running warehouse, inventory and customer service teams. Cut stock-holding costs by 18% while raising order accuracy to 99.4%. Skilled in demand planning, vendor negotiation and coaching. Known for calm, practical leadership through peak season and for turning front-line ideas into lasting process improvements.",
  ),
  experienceOrder: "newest",
  experience: [
    {
      startDate: "January 2023",
      endDate: "January 2024",
      isCurrent: false,
      jobTitle: "Operations Manager",
      company: "Brightline Logistics",
      location: "Austin, TX",
      logo: "",
      description: bulletsToDoc([
        "Redesigned the slotting and cycle-count process for a 40,000 sq ft warehouse, raising pick accuracy from 97.1% to 99.4% within six months.",
        "Led the operations workstream when two regional depots merged, moving 3,000+ SKUs onto one inventory system with no missed deliveries.",
        "Introduced a same-day escalation desk for customer issues, cutting average resolution time from four days to under one.",
        "Built a weekly demand forecast with the sales team that reduced emergency freight spend by 22%.",
        "Ran the site safety programme and quarterly audits, finishing the year with zero lost-time incidents.",
        "Negotiated new terms with three key carriers, saving $140K a year while improving on-time pickup rates.",
        "Coached four shift leads through performance plans; three were later promoted.",
        "Cleared a 9-month backlog of obsolete stock through bundling and liquidation, freeing 15% of storage space.",
      ]),
    },
    {
      startDate: "January 2022",
      endDate: "January 2023",
      isCurrent: false,
      jobTitle: "Assistant Operations Manager",
      company: "Brightline Logistics",
      location: "Austin, TX",
      logo: "",
      description: bulletsToDoc([
        "Scheduled a team of 25 across three shifts and kept overtime below 5% of total hours during peak season.",
        "Wrote 6 standard operating procedures for receiving, returns and stock transfers, and trained every new team member on them.",
        "Acted as the main contact for 12 suppliers and affiliated carriers, resolving delivery and invoice issues within 48 hours.",
      ]),
    },
    {
      startDate: "January 2024",
      endDate: "",
      isCurrent: true,
      jobTitle: "Senior Operations Manager",
      company: "Brightline Logistics",
      location: "Austin, TX",
      logo: "",
      description: bulletsToDoc([
        "Oversee daily operations for two distribution centres handling 6,500 orders a day.",
        "Introduced barcode scanning at returns intake, cutting processing time per item by 40%.",
        "Partner with finance on monthly stock reconciliation, keeping variance under 0.3%.",
        "Manage an annual operating budget of $4.2M and report progress to the regional director.",
        "Rolled out a cross-training programme so every team member can cover at least two roles, lifting labour efficiency by 12%.",
        "Plan seasonal staffing with HR, hiring and training 40 temporary staff each autumn.",
        "Review 200+ incoming shipments a week against purchase orders and resolve discrepancies with suppliers.",
        "Lead a weekly continuous-improvement meeting where front-line staff propose and test process changes.",
      ]),
    },
  ],
  projects: [
    {
      name: "Returns automation pilot",
      link: "",
      description: bulletsToDoc([
        "Mapped the returns workflow end to end and introduced handheld scanners at two intake stations.",
        "Cut manual data entry by 60% and gave the finance team same-day visibility of credits owed.",
      ]),
    },
  ],
  education: [
    {
      year: "2018",
      degree: "Bachelor of Business Administration, Supply Chain Management",
      institution: "State University",
    },
  ],
  certifications: [
    { name: "Certified Supply Chain Professional (CSCP)", issuer: "ASCM", year: "2021" },
    { name: "OSHA 30-Hour General Industry", issuer: "OSHA Training Institute", year: "2019" },
  ],
  skillGroups: [
    {
      name: "Inventory planning and control",
      rating: 8,
      skills: items("Cycle counting", "Demand forecasting", "Slotting optimisation"),
    },
    {
      name: "Vendor negotiation and purchasing",
      rating: 7,
      skills: items("Carrier contracts", "Supplier scorecards"),
    },
    {
      name: "Team leadership and coaching",
      rating: 9,
      skills: items("Shift planning", "Performance coaching"),
    },
    {
      name: "Logistics and shipping coordination",
      rating: 7,
      skills: items("Returns processing", "Freight scheduling", "Receiving"),
    },
    {
      name: "Warehouse Software",
      rating: 10,
      skills: items("WMS administration", "Barcode scanning"),
    },
  ],
  languages: [
    { name: "English", level: "native" },
    { name: "Spanish", level: "conversational" },
  ],
  style: defaultStyle(),
  sidebarSummary: "Hands-on operations leader who lowers costs, lifts accuracy and builds teams that keep improving.",
};
