import { SpinningLogo } from "@/components/spinning-logo";

export function Loader() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <SpinningLogo className="h-12 w-12" />
    </div>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <SpinningLogo className="h-16 w-16" />
    </div>
  );
}
