import { getImageProps } from "next/image";

export const PROFILE_SIZES = "(max-width: 512px) calc(100vw - 32px), (max-width: 1024px) 460px, 440px";
const decodedImages = new Map<string,{image:HTMLImageElement;ready:Promise<void>}>();
export function optimizableImage(src: string): boolean {
  if (src.startsWith("/") && !src.startsWith("//")) return true;
  try {
    const url = new URL(src);
    return url.protocol === "https:" && (url.hostname === "images.unsplash.com" || url.hostname === "picsum.photos" || url.hostname.endsWith(".supabase.co"));
  } catch { return false; }
}

// The preloader must decode exactly the resource next/image chooses, not the original.
export function profileImageProps(src: string) {
  return getImageProps({ src, alt: "", width: 800, height: 1000, sizes: PROFILE_SIZES, quality: 75, unoptimized: !optimizableImage(src) }).props;
}

export function preloadProfileImage(src: string): HTMLImageElement {
  const key=`${src}:${window.innerWidth}:${window.devicePixelRatio}`;
  const cached=decodedImages.get(key);
  if(cached)return cached.image;
  const props = profileImageProps(src);
  const image = new window.Image();
  image.decoding = "async";
  image.fetchPriority = "high";
  if (props.sizes) image.sizes = props.sizes;
  if (props.srcSet) image.srcset = props.srcSet;
  image.src = props.src;
  const ready=image.decode().catch(()=>undefined);
  decodedImages.set(key,{image,ready});
  if(decodedImages.size>8)decodedImages.delete(decodedImages.keys().next().value!);
  return image;
}

export async function ensureProfileDecoded(src: string): Promise<void> {
  preloadProfileImage(src);
  await decodedImages.get(`${src}:${window.innerWidth}:${window.devicePixelRatio}`)?.ready;
}
