import Image from "next/image";

type Props = { src?: string; alt: string; sizes: string; className?: string };

/** Product photo, or a neutral roll illustration while photos are missing. */
export function ItemImage({ src, alt, sizes, className = "" }: Props) {
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <svg viewBox="0 0 64 64" className="absolute inset-0 m-auto h-1/2 w-1/2 text-line" aria-hidden>
          <circle cx="32" cy="32" r="26" fill="currentColor" />
          <circle cx="32" cy="32" r="19" fill="var(--surface)" />
          <circle cx="32" cy="32" r="8" fill="currentColor" />
        </svg>
      )}
    </div>
  );
}
