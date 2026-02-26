// Formatting utilities

export function formatOdds(american: number): string {
  if (american > 0) return `+${american}`;
  return `${american}`;
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function edgeStrengthColor(strength: string): string {
  switch (strength) {
    case "extreme":
      return "text-red-500 dark:text-red-400";
    case "strong":
      return "text-orange-500 dark:text-orange-400";
    case "moderate":
      return "text-yellow-500 dark:text-yellow-400";
    case "mild":
      return "text-green-500 dark:text-green-400";
    default:
      return "text-gray-500";
  }
}

export function edgeStrengthBg(strength: string): string {
  switch (strength) {
    case "extreme":
      return "bg-red-500/10 border-red-500/30";
    case "strong":
      return "bg-orange-500/10 border-orange-500/30";
    case "moderate":
      return "bg-yellow-500/10 border-yellow-500/30";
    case "mild":
      return "bg-green-500/10 border-green-500/30";
    default:
      return "bg-gray-500/10 border-gray-500/30";
  }
}

export function injuryStatusColor(status: string): string {
  switch (status) {
    case "out":
      return "text-red-500 bg-red-500/10";
    case "doubtful":
      return "text-orange-500 bg-orange-500/10";
    case "questionable":
      return "text-yellow-500 bg-yellow-500/10";
    case "probable":
      return "text-green-500 bg-green-500/10";
    case "day-to-day":
      return "text-blue-500 bg-blue-500/10";
    default:
      return "text-gray-500 bg-gray-500/10";
  }
}
