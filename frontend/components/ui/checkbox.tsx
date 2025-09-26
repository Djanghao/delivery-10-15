import { clsx } from "clsx";
import { InputHTMLAttributes } from "react";

export function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={clsx(
        "h-4 w-4 rounded border-gray-300 text-black focus:ring-black",
        className
      )}
      {...props}
    />
  );
}

