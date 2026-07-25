"use client";

import { useEffect } from "react";
import { applyThemeToDocument } from "@/config/themes";

/** Aplica la paleta guardada en el documento (SSR + navegación). */
export function OrganizationTheme({ themeId }: { themeId: string }) {
  useEffect(() => {
    applyThemeToDocument(themeId);
  }, [themeId]);

  return null;
}
