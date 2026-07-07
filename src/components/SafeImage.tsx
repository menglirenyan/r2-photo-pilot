"use client";

import Image from "next/image";
import { ImageIcon } from "lucide-react";
import { useState } from "react";

type SafeImageProps = {
  src: string;
  alt: string;
  priority?: boolean;
  sizes: string;
};

export function SafeImage({ src, alt, priority = false, sizes }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="image-fallback" role="img" aria-label={alt}>
        <ImageIcon size={24} />
        <span>{alt}</span>
      </div>
    );
  }

  return <Image src={src} alt={alt} fill priority={priority} sizes={sizes} loading={priority ? "eager" : "lazy"} onError={() => setFailed(true)} />;
}
