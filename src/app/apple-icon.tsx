import { renderAppIcon } from "@/lib/app-icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Ikona pro iPhone (když si uživatel přidá ELITEZ na plochu). */
export default function AppleIcon() {
  return renderAppIcon(180, 0);
}
