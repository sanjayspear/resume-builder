"use client";

import Link from "next/link";
import { sortedByUpdated } from "@/lib/library";
import { useLibrary } from "@/lib/libraryStore";

const NAV = [
  { href: "/", label: "My resumes", key: "resumes", mobile: true },
  // Sections of the home page; on phones you reach them by scrolling, so
  // these two tabs are hidden there to leave room for Guide and About.
  { href: "/#templates", label: "Templates", key: "templates", mobile: false },
  { href: "/#backup", label: "Backup", key: "backup", mobile: false },
  { href: "/guide", label: "Guide", key: "guide", mobile: true },
  { href: "/about", label: "About", key: "about", mobile: true },
] as const;

/** Initials from the most recently edited resume's name ("Maya Fernandes" -> "MF"). */
function initialsFromLatestResume(names: string[]): string {
  const name = names.find((n) => n.trim()) ?? "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Top bar shared by every page: logo, section tabs, initials badge. */
export function AppHeader({
  active = "resumes",
  wide = false,
}: {
  active?: (typeof NAV)[number]["key"] | null;
  /** The editor uses the full screen width; the home page a centred column. */
  wide?: boolean;
}) {
  const library = useLibrary();
  const initials = library
    ? initialsFromLatestResume(sortedByUpdated(library).map((r) => r.data.personal?.fullName ?? ""))
    : "";

  return (
    <header className="glass-bar">
      <div className={`mx-auto flex h-16 items-center gap-2 px-4 sm:gap-4 sm:px-6 ${wide ? "max-w-[1600px]" : "max-w-[57rem]"}`}>
        <Link href="/" className="flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-600">
          <span className="gloss-tile flex h-8 w-8 items-center justify-center rounded-lg">
            <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
              <path d="M14 3v5h5M9 13h6M9 17h4" />
            </svg>
          </span>
          <span className="hidden text-[15px] font-bold tracking-tight text-slate-900 sm:inline">Resume Builder</span>
        </Link>

        <nav aria-label="Main" className="flex min-w-0 items-center gap-0.5 overflow-x-auto p-0.5 sm:gap-1">
          {NAV.map((item) => {
            const isActive = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`whitespace-nowrap rounded-lg px-2 py-1.5 text-[13px] font-medium transition sm:px-3 sm:text-sm ${
                  item.mobile ? "" : "hidden md:inline-block"
                } ${
                  isActive ? "bg-gradient-to-b from-white to-indigo-100/80 text-indigo-700 shadow-[inset_0_1px_0_#fff,0_0_0_1px_rgb(99_102_241/0.18)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {initials && (
          <span
            className="gloss-tile ml-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold"
            title="Initials from your latest resume"
            aria-hidden
          >
            {initials}
          </span>
        )}
      </div>
    </header>
  );
}
