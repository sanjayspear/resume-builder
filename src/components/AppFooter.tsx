import Link from "next/link";

/** Small footer with links to the guide and the about page. */
export function AppFooter() {
  return (
    <footer className="mx-auto max-w-[57rem] px-4 pb-10 sm:px-6">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/80 pt-5 text-xs text-slate-500">
        <span className="mr-auto">Resume Builder · your resumes stay in this browser</span>
        <Link href="/guide" className="font-medium hover:text-indigo-700">
          User guide
        </Link>
        <Link href="/about" className="font-medium hover:text-indigo-700">
          About
        </Link>
      </div>
    </footer>
  );
}
