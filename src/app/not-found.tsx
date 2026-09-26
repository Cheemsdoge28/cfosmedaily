import Link from "next/link";

import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          404
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-heading">Page not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you asked for does not exist, or you no longer have access to
          it.
        </p>
        <ButtonLink
          size="lg"
          className="mt-6"
          render={<Link href="/dashboard" />}
        >
          Back to the dashboard
        </ButtonLink>
      </div>
    </main>
  );
}
