import { HTMLAttributes } from "react";
import { clsx } from "clsx";

export function ScrollArea({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx("overflow-auto", className)} {...props} />;
}

