import { APP_LOGO_SRC, APP_NAME } from "@/config/brand";
import { cn } from "@/lib/utils";

type AppBrandLogoProps = {
  className?: string;
  /** Tamaño visual: auth (grande), header (compacto). */
  size?: "auth" | "header" | "sm";
};

const sizeClass: Record<NonNullable<AppBrandLogoProps["size"]>, string> = {
  auth: "mx-auto h-auto w-full max-w-[360px] object-center sm:max-w-[400px]",
  header: "h-9 w-auto max-w-[200px] object-left",
  sm: "h-7 w-auto max-w-[160px] object-left",
};

export function AppBrandLogo({
  className,
  size = "auth",
}: AppBrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- asset estático en /public
    <img
      src={APP_LOGO_SRC}
      alt={APP_NAME}
      width={1024}
      height={559}
      className={cn(sizeClass[size], "object-contain", className)}
      decoding="async"
    />
  );
}
