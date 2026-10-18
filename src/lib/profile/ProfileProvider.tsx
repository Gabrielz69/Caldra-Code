import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KEY = "caldra.profile.v1";

export type Profile = {
  name: string;
  role: string;
  photo: string | null;
  onboarded: boolean;
};

const DEFAULTS: Profile = { name: "", role: "Caldeireiro", photo: null, onboarded: false };

type ProfileValue = Profile & {
  displayName: string;
  ready: boolean;
  update: (patch: Partial<Profile>) => void;
};

const Ctx = createContext<ProfileValue | null>(null);

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const autoOnboard = sp.get("autostart") === "1";
      const raw = window.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Profile>;
        setProfile({ ...DEFAULTS, ...parsed, ...(autoOnboard ? { onboarded: true } : {}) });
      } else if (autoOnboard) {
        setProfile({ ...DEFAULTS, onboarded: true });
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify(profile));
    } catch {
      /* ignore */
    }
  }, [profile, ready]);

  const value = useMemo<ProfileValue>(
    () => ({
      ...profile,
      ready,
      displayName: profile.name.trim() || "Caldeireiro CALDRA",
      update: (patch) => setProfile((p) => ({ ...p, ...patch })),
    }),
    [profile, ready],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useProfile deve ser usado dentro de ProfileProvider");
  return ctx;
}

/** Lê um arquivo de imagem, recorta ao centro e devolve um dataURL quadrado. */
export function fileToSquareDataUrl(file: File, size = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Falha ao ler a imagem."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Imagem inválida."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponível."));
        const side = Math.min(img.width, img.height);
        ctx.drawImage(
          img,
          (img.width - side) / 2,
          (img.height - side) / 2,
          side,
          side,
          0,
          0,
          size,
          size,
        );
        resolve(canvas.toDataURL("image/jpeg", 0.86));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
