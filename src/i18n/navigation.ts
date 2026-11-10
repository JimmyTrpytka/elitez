import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Odkazy a přesměrování, které automaticky drží zvolený jazyk. */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
