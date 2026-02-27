import clsx from "clsx";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  glow?: boolean;
  onClick?: () => void;
}

export function Card({ children, className, glow, onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        "rounded-xl border bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 p-4 sm:p-6",
        glow && "animate-pulse-glow",
        onClick && "cursor-pointer hover:border-brand-500/50 transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("mb-4 flex items-center justify-between", className)}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h3
      className={clsx(
        "text-lg font-semibold text-gray-900 dark:text-white",
        className
      )}
    >
      {children}
    </h3>
  );
}
