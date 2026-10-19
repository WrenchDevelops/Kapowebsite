"use client";

export function OpenSupportButton({
  children,
  className,
  help,
}: {
  children: React.ReactNode;
  className?: string;
  help?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        window.dispatchEvent(new CustomEvent("kapo-support", { detail: { help } }));
      }}
    >
      {children}
    </button>
  );
}
