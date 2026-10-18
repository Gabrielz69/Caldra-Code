import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { useProfile } from "@/lib/profile/ProfileProvider";
import { PhotoPicker } from "./Profile";
import { cn } from "@/lib/utils";

const ROLES = [
  "Caldeireiro",
  "Traçador",
  "Soldador",
  "Projetista",
  "Estudante",
  "Técnico",
  "Outro",
];

/** Passo "Vamos nos conhecer melhor" — nome, profissão e foto. */
export function Onboarding() {
  const { name, role, photo, update } = useProfile();
  const [localName, setLocalName] = useState(name);
  const [localRole, setLocalRole] = useState(role || "Caldeireiro");

  return (
    <div className="fade-up fixed inset-0 z-[95] flex flex-col overflow-y-auto bg-background px-6 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 grid-bg opacity-30" />
      <div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6">
        <header className="text-center">
          <span className="tick-label">CALDRA</span>
          <h1 className="mt-1 font-display text-3xl leading-tight font-semibold">
            Vamos nos conhecer melhor
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Personalize o laboratório com o seu perfil.
          </p>
        </header>

        <PhotoPicker
          photo={photo}
          size={124}
          label={photo ? "Trocar foto" : "Adicionar foto"}
          onPhoto={(p) => update({ photo: p })}
        />

        <label className="block">
          <span className="tick-label">Nome</span>
          <input
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            placeholder="Seu nome"
            className="mt-1 w-full rounded-xl border border-line bg-background/50 px-3 py-3 text-[15px] outline-none focus:border-accent"
          />
        </label>

        <div>
          <span className="tick-label">Profissão</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {ROLES.map((r) => (
              <button
                key={r}
                onClick={() => setLocalRole(r === "Outro" ? "" : r)}
                className={cn(
                  "rounded-full border px-3 py-1.5 font-mono text-[11px] transition-colors",
                  localRole === r
                    ? "border-accent/30 bg-accent/10 text-accent"
                    : "border-line text-muted-foreground",
                )}
              >
                {r}
              </button>
            ))}
          </div>
          <input
            value={localRole}
            onChange={(e) => setLocalRole(e.target.value)}
            placeholder="Escreva sua profissão"
            className="mt-2 w-full rounded-xl border border-line bg-background/50 px-3 py-3 text-[15px] outline-none focus:border-accent"
          />
        </div>

        <button
          onClick={() =>
            update({
              name: localName.trim(),
              role: localRole.trim() || "Caldeireiro",
              onboarded: true,
            })
          }
          className="brand-gradient flex items-center justify-center gap-2 rounded-2xl py-3.5 font-display text-sm font-semibold text-background"
        >
          Continuar <ArrowRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
