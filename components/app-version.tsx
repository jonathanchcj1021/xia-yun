import { appVersion } from "@/lib/version";

export function AppVersion({ label }: { label: string }) {
  const version = appVersion();
  return (
    <p className="text-xs text-muted-foreground" data-app-version={version}>
      {label} {version}
    </p>
  );
}
