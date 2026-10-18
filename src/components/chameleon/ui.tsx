import { Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFeatureAccess } from "@/lib/subscription/SubscriptionProvider";
import { FEATURE_PITCH, type Feature } from "@/lib/subscription/features";
import { formatNumber } from "@/lib/settings/SettingsProvider";

export function SectionLabel({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className={cn("t-eyebrow", className)}>{children}</h2>
      {action}
    </div>
  );
}

export function Panel({
  className,
  children,
  glow = false,
}: {
  className?: string;
  children: React.ReactNode;
  glow?: boolean;
}) {
  return <div className={cn("glass rounded-2xl", glow && "glow-ring", className)}>{children}</div>;
}

export function Metric({
  label,
  value,
  suffix,
  precision = 2,
}: {
  label: string;
  value: number;
  suffix?: string;
  precision?: number;
}) {
  return (
    <div className="rounded-lg border border-line bg-background/40 p-2">
      <p className="font-mono text-[9px] text-muted-foreground uppercase">{label}</p>
      <p className="mt-0.5 font-mono text-[14px]">
        {formatNumber(value, precision)}
        {suffix && <span className="text-[10px] text-muted-foreground"> {suffix}</span>}
      </p>
    </div>
  );
}

export function PlanBadge({ premium }: { premium: boolean }) {
  return (
    <span
      className={cn(
        "rounded border px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase",
        premium
          ? "border-accent/30 bg-accent/10 text-accent"
          : "border-border text-muted-foreground",
      )}
    >
      {premium ? "Mestre" : "Free"}
    </span>
  );
}

export function StatusBadge({ status }: { status: "pronto" | "em-desenvolvimento" }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 font-mono text-[9px] tracking-wider uppercase",
        status === "pronto" ? "bg-accent/10 text-accent" : "bg-warn/10 text-warn",
      )}
    >
      {status === "pronto" ? "Pronto" : "Em desenvolvimento"}
    </span>
  );
}

/** Guard de funcionalidade: conteúdo só é montado quando o plano permite. */
export function FeatureGate({
  feature,
  title,
  description,
  children,
}: {
  feature: Feature;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { can } = useFeatureAccess();
  if (can(feature)) return <>{children}</>;
  return (
    <Panel className="p-6 text-center">
      <div className="pro-surface mx-auto grid size-11 place-items-center rounded-xl text-pro">
        <Lock className="size-4" />
      </div>
      <span className="pro-surface mx-auto mt-3 inline-block rounded-full px-2 py-0.5 font-mono text-[9px] tracking-[0.18em] text-pro uppercase">
        Pro
      </span>
      <h3 className="mt-3 font-display text-base">{title}</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      <p className="mx-auto mt-2 max-w-sm text-[12px] text-muted-foreground">
        {FEATURE_PITCH[feature].benefit}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <Link
          to="/pro"
          className="pro-gradient inline-block rounded-xl px-4 py-2 text-sm font-semibold"
        >
          Conhecer o CALDRA PRO
        </Link>
        <Link
          to="/perfil"
          hash="pro"
          className="inline-block rounded-xl border border-line px-4 py-2 text-sm"
        >
          Já tenho código
        </Link>
      </div>
    </Panel>
  );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-8 text-center">
      <p className="t-subtitle">{title}</p>
      <p className="t-caption mt-1">{hint}</p>
    </div>
  );
}

export function DemoTag() {
  return (
    <span className="rounded border border-warn/30 bg-warn/10 px-1.5 py-0.5 font-mono text-[9px] tracking-wider text-warn uppercase">
      Demonstrativo
    </span>
  );
}
