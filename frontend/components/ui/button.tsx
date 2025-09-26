import { clsx } from "clsx";
import { ButtonHTMLAttributes } from "react";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium",
        "bg-black text-white hover:opacity-90 disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

