export type ReportedMetrics = { likes?: number; comments?: number; shares?: number };
export const reportedCount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
export function sumReported(rows: { metrics?: ReportedMetrics }[], key: keyof ReportedMetrics): number | null {
  const values = rows.map((row) => row.metrics?.[key]).filter(reportedCount);
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null;
}
export function hasReportedMetrics(metrics?: ReportedMetrics) {
  return !!metrics && [metrics.likes, metrics.comments, metrics.shares].some(reportedCount);
}
export function totalReported(rows: { metrics?: ReportedMetrics }[]): number | null {
  const totals = (["likes", "comments", "shares"] as const).map((key) => sumReported(rows, key)).filter(reportedCount);
  return totals.length ? totals.reduce((sum, value) => sum + value, 0) : null;
}
export function followerTotal(channels: { followers: number | null }[]) {
  const known = channels.map((channel) => channel.followers).filter(reportedCount);
  return known.length ? known.reduce((sum, value) => sum + value, 0) : null;
}
