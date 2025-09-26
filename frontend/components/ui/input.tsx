import { clsx } from "clsx";
import { InputHTMLAttributes } from "react";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "h-9 w-full rounded-full border px-3 text-sm outline-none focus:ring-2 focus:ring-black/10",
        className
      )}
      {...props}
    />
  );
}

