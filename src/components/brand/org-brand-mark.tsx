"use client";

import { useState } from "react";
import { APP_MARK_SRC, APP_NAME } from "@/config/brand";
import { cn } from "@/lib/utils";

type OrgBrandMarkProps = {
  /** Logo de la empresa (ya resuelto a src usable). Si falta, se usa SimpleObra. */
  logoUrl?: string | null;
  className?: string;
  /** Clase del <img> de la empresa (marco claro sobre sidebar oscuro). */
  orgClassName?: string;
  /** Clase del <img> de SimpleObra. */
  appClassName?: string;
};

/**
 * Avatar de marca en sidebar/nav:
 * 1) logo de la empresa (Configuración), si está cargado y carga bien
 * 2) si no, marca SimpleObra
 */
export function OrgBrandMark({
  logoUrl,
  className,
  orgClassName,
  appClassName,
}: OrgBrandMarkProps) {
  const [failed, setFailed] = useState(false);
  const showOrg = Boolean(logoUrl) && !failed;

  if (showOrg) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl!}
        alt=""
        className={cn(className, orgClassName)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={APP_MARK_SRC}
      alt={APP_NAME}
      className={cn(className, appClassName)}
    />
  );
}
