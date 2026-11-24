/*
 * A FICTIONAL QA engineer resume used by the ATS-check tests. The person,
 * contact details and employers are invented (the repository is public).
 * The dates deliberately mix styles ("Sept 2017", "Oct 2022", "April 2025").
 */
import { bulletsToDoc, textToDoc } from "@/lib/richText";
import { emptyResume, type ResumeData } from "@/lib/schema";

export function qaResume(): ResumeData {
  const data = emptyResume();
  return {
    ...data,
    personal: {
      fullName: "Arjun Rao",
      jobTitle: "Senior QA Automation Engineer",
      location: "Pune, India",
      phone: "+91 90XXX XXXXX",
      email: "arjun.rao@example.com",
      website: "",
      linkedin: "linkedin.com/in/your-profile",
    },
    summary: textToDoc(
      "QA automation engineer with 8+ years of experience building UI and API test frameworks for banking and insurance products. " +
        "Led a Selenium-to-Playwright migration that cut regression time by 60%, built Karate suites for REST APIs, and wired automated quality gates into Jenkins CI/CD pipelines. " +
        "Comfortable in Agile teams and with SQL, Git and Jira.",
    ),
    experience: [
      {
        startDate: "April 2025", endDate: "", isCurrent: true, jobTitle: "Senior QA Automation Engineer", company: "Northwind Bank Technology", location: "Pune", logo: "",
        description: bulletsToDoc([
          "Built Playwright UI suites in TypeScript covering 400+ customer journeys across Chrome, Firefox and WebKit.",
          "Automated REST API tests with Karate and validated JSON schemas for 30 microservices.",
          "Integrated test runs into Jenkins pipelines with quality gates that block failing builds.",
        ]),
      },
      {
        startDate: "Oct 2022", endDate: "April 2025", isCurrent: false, jobTitle: "QA Engineer", company: "Contoso Insurance Systems", location: "Pune", logo: "",
        description: bulletsToDoc([
          "Migrated 600 Selenium WebDriver tests to Playwright, cutting regression time from 5 hours to 2.",
          "Wrote API checks in Postman and SQL queries to verify claims data.",
        ]),
      },
      {
        startDate: "Sept 2017", endDate: "Sep 2022", isCurrent: false, jobTitle: "Test Engineer", company: "Fabrikam Software Services", location: "Bengaluru", logo: "",
        description: bulletsToDoc([
          "Executed manual and automated tests with Selenium WebDriver, TestNG and the Page Object Model.",
          "Tracked defects in Jira and documented test plans in Confluence.",
        ]),
      },
    ],
    education: [{ year: "2017", degree: "B.E. Computer Science", institution: "Example Institute of Technology" }],
    skillGroups: [
      { name: "Test Automation", rating: 9, skills: [{ value: "Playwright" }, { value: "Selenium WebDriver" }, { value: "Karate" }, { value: "TestNG" }] },
      { name: "CI/CD & Tools", rating: 8, skills: [{ value: "Jenkins" }, { value: "Git" }, { value: "Jira" }] },
    ],
    languages: [{ name: "English", level: "professional" }],
  };
}
