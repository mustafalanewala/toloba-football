import Image from "next/image";
import logo from "../../public/logo.png";

export function Logo({ className = "size-12" }: { className?: string }) {
  return (
    <Image
      src={logo}
      alt="Toloba ul Kulliyaat il Mumenoon"
      priority
      sizes="80px"
      className={`shrink-0 rounded-lg bg-white object-contain ${className}`}
    />
  );
}
