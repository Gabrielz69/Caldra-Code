import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  prompt: z.string().trim().min(3).max(1000),
  duration: z.number().min(5).max(120),
});

export const Route = createFileRoute("/api/music")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env["ELEVENLABS_API_KEY"];
        if (!key) return new Response("Serviço de música não conectado.", { status: 500 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Descrição inválida.", { status: 400 });
        const res = await fetch("https://api.elevenlabs.io/v1/music", {
          method: "POST",
          headers: { "xi-api-key": key, "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: parsed.data.prompt,
            music_length_ms: Math.round(parsed.data.duration * 1000),
          }),
        });
        if (!res.ok) {
          const t = await res.text();
          console.error(`Music failed [${res.status}]: ${t}`);
          return new Response(t || "Falha ao gerar música.", { status: res.status });
        }
        return new Response(res.body, { headers: { "Content-Type": "audio/mpeg" } });
      },
    },
  },
});
