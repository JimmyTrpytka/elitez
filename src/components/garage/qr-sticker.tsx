"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";

export type QrTarget = { id: string; label: string; url: string; title: string };

const YELLOW = "#ffd60a";
const INK = "#070707";

/** Písmo nadpisů (next/font mu dá vlastní název) – pro kreslení do obrázku. */
function displayFont(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--font-display-family").trim();
  return v || "Arial Narrow, sans-serif";
}

/**
 * QR samolepka za okno: žlutá karta, černý QR, „DEJ MI TURBO“.
 * Jde stáhnout jako obrázek (PNG) nebo vytisknout.
 */
export function QrSticker({ targets, username }: { targets: QrTarget[]; username: string }) {
  const t = useTranslations("Qr");
  const [selected, setSelected] = useState(targets[0]?.id ?? "");
  const target = useMemo(() => targets.find((x) => x.id === selected) ?? targets[0], [targets, selected]);
  const [svg, setSvg] = useState("");

  useEffect(() => {
    if (!target) return;
    let cancelled = false;
    QRCode.toString(target.url, {
      type: "svg",
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: INK, light: "#00000000" },
    }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  async function download() {
    if (!target) return;
    const W = 1200;
    const H = 1600;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    await document.fonts.ready;
    const font = displayFont();

    // Žlutý podklad se zaoblenými rohy
    ctx.fillStyle = YELLOW;
    ctx.beginPath();
    ctx.roundRect(0, 0, W, H, 64);
    ctx.fill();

    ctx.fillStyle = INK;
    ctx.textAlign = "center";
    ctx.font = `800 150px ${font}`;
    ctx.fillText(t("stickerHeadline").toUpperCase(), W / 2, 230);

    // QR kód
    const qr = document.createElement("canvas");
    await QRCode.toCanvas(qr, target.url, {
      width: 860,
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: INK, light: YELLOW },
    });
    ctx.drawImage(qr, (W - 860) / 2, 330);

    ctx.font = `800 96px ${font}`;
    ctx.fillText(target.title.toUpperCase().slice(0, 22), W / 2, 1330);
    ctx.font = `600 54px ${font}`;
    ctx.fillText(`@${username}`, W / 2, 1410);
    ctx.font = `800 64px ${font}`;
    ctx.fillText("● ELITEZ", W / 2, 1530);

    const a = document.createElement("a");
    a.download = `elitez-qr-${username}.png`;
    a.href = canvas.toDataURL("image/png");
    a.click();
  }

  if (!target) return null;

  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-start">
      {/* Náhled samolepky (tiskne se jen ten) */}
      <div className="qr-print mx-auto w-full max-w-sm shrink-0">
        <div className="flex flex-col items-center rounded-[2rem] bg-accent px-8 pt-8 pb-7 text-center text-ink shadow-[0_30px_80px_-30px_rgb(255_214_10/0.6)]">
          <p className="font-display text-5xl leading-none font-extrabold uppercase">{t("stickerHeadline")}</p>
          <div
            className="mt-6 aspect-square w-full [&_svg]:h-full [&_svg]:w-full"
            aria-label={t("qrAlt", { title: target.title })}
            role="img"
            dangerouslySetInnerHTML={{ __html: svg }}
          />
          <p className="mt-6 font-display text-3xl leading-none font-extrabold uppercase">{target.title}</p>
          <p className="mt-1 text-sm font-semibold">@{username}</p>
          <p className="mt-4 font-display text-xl font-extrabold tracking-[0.15em]">● ELITEZ</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-5 print:hidden">
        {targets.length > 1 ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium text-ink">{t("targetLabel")}</legend>
            {targets.map((x) => (
              <label
                key={x.id}
                className="flex cursor-pointer items-center gap-3 rounded-control border border-line p-4 has-[:checked]:border-ink has-[:checked]:bg-muted"
              >
                <input
                  type="radio"
                  name="qr-target"
                  value={x.id}
                  checked={selected === x.id}
                  onChange={() => setSelected(x.id)}
                  className="h-5 w-5 accent-ink"
                />
                <span className="font-semibold text-ink">{x.label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <p className="text-sm break-all text-subtle">{target.url}</p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void download()}>
            {t("download")}
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            {t("print")}
          </Button>
        </div>
        <ul className="list-disc space-y-1 pl-5 text-sm text-ink-soft">
          <li>{t("tip1")}</li>
          <li>{t("tip2")}</li>
          <li>{t("tip3")}</li>
        </ul>
      </div>
    </div>
  );
}
