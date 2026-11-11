"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Odeslání formuláře BEZ automatického vymazání polí.
 * React 19 po `<form action={…}>` vyplněná pole vymaže – i když server vrátí chybu,
 * takže by uživatel přišel o vše, co napsal. Tady formulář odešleme ručně.
 * Kontrola povinných polí v prohlížeči (required) funguje dál.
 */
export function useKeepValuesSubmit(dispatch: (formData: FormData) => void) {
  return (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(() => dispatch(formData));
  };
}
