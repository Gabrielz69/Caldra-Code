import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Music, Download, Loader2 } from "lucide-react";
import { Panel, SectionLabel } from "@/components/chameleon/ui";

export const Route = createFileRoute("/musica")({
  head: () => ({
    meta: [
      { title: "Gerar música — CALDRA" },
      { name: "description", content: "Crie trilhas, jingles e música de fundo a partir de uma descrição." },
      { property: "og:title", content: "Gerar música — CALDRA" },
      { property: "og:description", content: "Trilhas, jingles e música de fundo criados por IA." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MusicPage,
});

const PRESETS = [
  "Trilha cinematográfica industrial, percussão metálica, épica",
  "Jingle alegre e curto para oficina de caldeiraria",
  "Música de fundo calma, lo-fi, para estudar",
];

function MusicPage() {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, duration }),
      });
      if (!r.ok) throw new Error((await r.text()) || `Erro ${r.status}`);
      const blob = await r.blob();
      if (url) URL.revokeObjectURL(url);
      setUrl(URL.createObjectURL(blob));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao gerar música.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="font-display text-2xl">Gerar música</h1>
      <Panel className="space-y-4 p-5">
        <SectionLabel>Descrição</SectionLabel>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Ex.: trilha épica com percussão metálica"
          className="w-full rounded-xl border border-line bg-background/40 p-3 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setPrompt(p)} className="rounded-full border border-line px-3 py-1 text-xs">
              {p}
            </button>
          ))}
        </div>
        <label className="block text-sm">
          Duração: {duration}s
          <input type="range" min={5} max={120} step={5} value={duration}
            onChange={(e) => setDuration(Number(e.target.value))} className="mt-2 w-full" />
        </label>
        <button
          onClick={generate}
          disabled={loading || prompt.trim().length < 3}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Music className="size-4" />}
          {loading ? "Gerando…" : "Gerar música"}
        </button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </Panel>
      {url && (
        <Panel className="space-y-3 p-5">
          <audio controls src={url} className="w-full" />
          <a href={url} download="caldra-musica.mp3" className="inline-flex items-center gap-2 text-sm text-accent">
            <Download className="size-4" /> Baixar MP3
          </a>
        </Panel>
      )}
    </div>
  );
}
