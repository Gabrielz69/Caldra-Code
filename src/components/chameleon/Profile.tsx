import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Camera, Settings, User, X } from "lucide-react";
import { toast } from "sonner";
import { fileToSquareDataUrl, useProfile } from "@/lib/profile/ProfileProvider";
import { cn } from "@/lib/utils";

/** Bolha circular com a foto do usuário (ou avatar padrão minimalista). */
export function Avatar({
  photo,
  size = 36,
  className,
}: {
  photo: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "metal grid shrink-0 place-items-center overflow-hidden rounded-full",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {photo ? (
        <img src={photo} alt="Foto de perfil" className="size-full object-cover" />
      ) : (
        <User
          className="text-muted-foreground"
          strokeWidth={1.3}
          style={{ width: size * 0.5, height: size * 0.5 }}
        />
      )}
    </span>
  );
}

/** Botão de escolha/troca de foto — usado no perfil e no onboarding. */
export function PhotoPicker({
  photo,
  onPhoto,
  size = 128,
  label = "Adicionar foto",
}: {
  photo: string | null;
  onPhoto: (dataUrl: string) => void;
  size?: number;
  label?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="group relative rounded-full transition-transform active:scale-95"
        aria-label={label}
      >
        <Avatar photo={photo} size={size} className="amber-ring" />
        <span className="absolute right-0 bottom-0 grid size-8 place-items-center rounded-full bg-accent text-background">
          <Camera className="size-4" strokeWidth={1.6} />
        </span>
      </button>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase"
      >
        {busy ? "Processando…" : label}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setBusy(true);
          try {
            onPhoto(await fileToSquareDataUrl(file));
          } catch {
            toast.error("Não foi possível usar essa imagem.");
          } finally {
            setBusy(false);
          }
        }}
      />
    </div>
  );
}

/** Modal do perfil: foto grande, nome e ação de troca de foto. */
export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { photo, displayName, role, update } = useProfile();
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-background/80 px-6 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      onClick={() => onOpenChange(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="metal pop-in relative w-full max-w-xs rounded-3xl p-6 text-center"
      >
        <button
          onClick={() => onOpenChange(false)}
          aria-label="Fechar"
          className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
        <div className="flex flex-col items-center gap-3">
          <PhotoPicker
            photo={photo}
            size={132}
            label="Alterar foto de perfil"
            onPhoto={(p) => {
              update({ photo: p });
              toast.success("Foto atualizada.");
            }}
          />
          <div>
            <p className="font-display text-lg font-semibold">{displayName}</p>
            <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              {role || "Caldeireiro"}
            </p>
          </div>
          <Link
            to="/perfil"
            onClick={() => onOpenChange(false)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-line bg-background/50 px-4 py-2 font-mono text-xs uppercase text-muted-foreground transition-colors hover:border-accent/40 hover:text-accent"
          >
            <Settings className="size-3.5" />
            Perfil e Conta
          </Link>
        </div>
      </div>
    </div>
  );
}
