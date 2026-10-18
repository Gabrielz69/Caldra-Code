import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/chameleon/ds";

export type TextSpec = {
  text: string;
  width: number;
  height: number;
  bold: boolean;
  italic: boolean;
};

export function TextDialog({
  open,
  initial,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initial?: TextSpec;
  onClose: () => void;
  onConfirm: (spec: TextSpec) => void;
}) {
  const [value, setValue] = useState<TextSpec>(
    initial ?? { text: "", width: 80, height: 12, bold: false, italic: false },
  );
  useEffect(() => {
    if (open) setValue(initial ?? { text: "", width: 80, height: 12, bold: false, italic: false });
  }, [open, initial]);
  const field =
    "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-accent";
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="metal w-[min(92vw,28rem)] max-w-none border-line">
        <DialogHeader>
          <DialogTitle className="font-display">Texto</DialogTitle>
        </DialogHeader>
        <label className="space-y-1 text-xs text-muted-foreground">
          <span>Insira seu texto</span>
          <textarea
            autoFocus
            value={value.text}
            onChange={(e) => setValue({ ...value, text: e.target.value })}
            className={field}
            rows={3}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Largura (mm)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={value.width}
              onChange={(e) => setValue({ ...value, width: Math.max(0.5, Number(e.target.value)) })}
              className={field}
            />
          </label>
          <label className="space-y-1 text-xs text-muted-foreground">
            <span>Altura (mm)</span>
            <input
              type="number"
              min="0.5"
              step="0.5"
              value={value.height}
              onChange={(e) =>
                setValue({ ...value, height: Math.max(0.5, Number(e.target.value)) })
              }
              className={field}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant={value.bold ? "primary" : "secondary"}
            onClick={() => setValue({ ...value, bold: !value.bold })}
            aria-pressed={value.bold}
          >
            B
          </Button>
          <Button
            type="button"
            size="sm"
            variant={value.italic ? "primary" : "secondary"}
            onClick={() => setValue({ ...value, italic: !value.italic })}
            aria-pressed={value.italic}
          >
            <em>I</em>
          </Button>
        </div>
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            disabled={!value.text.trim()}
            onClick={() => onConfirm({ ...value, text: value.text.trim() })}
          >
            Inserir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
