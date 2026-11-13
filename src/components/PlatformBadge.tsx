import { platformFromUrl } from "../domain/platform";

interface Props {
  url: string;
  size?: "small" | "medium";
}

export function PlatformBadge({ url, size = "medium" }: Props) {
  const platform = platformFromUrl(url);
  if (!platform) return null;
  return (
    <span
      className={"platform-badge platform-badge--" + size}
      data-platform={platform.id}
      aria-hidden="true"
      style={{ backgroundColor: platform.color }}
    >
      {platform.icon ? (
        <img src={import.meta.env.BASE_URL + platform.icon.slice(1)} width="24" height="24" alt="" draggable={false} />
      ) : (
        <span className="platform-badge-letter">{platform.fallback}</span>
      )}
    </span>
  );
}
