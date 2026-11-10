import { ImageResponse } from "next/og";

/**
 * Provizorní ikona aplikace: bílé „E“ na černém pozadí se žlutou tečkou.
 * Až bude hotové logo, nahradí se.
 * `padding` zmenší obsah – pro „maskable“ ikony, které si telefon ořízne do kruhu.
 */
export function renderAppIcon(size: number, padding = 0): ImageResponse {
  const inner = size - padding * 2;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: inner,
            height: inner,
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: inner * 0.62,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            E
          </div>
          <div
            style={{
              position: "absolute",
              right: inner * 0.2,
              bottom: inner * 0.22,
              width: inner * 0.11,
              height: inner * 0.11,
              borderRadius: "50%",
              background: "#ffd60a",
            }}
          />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
