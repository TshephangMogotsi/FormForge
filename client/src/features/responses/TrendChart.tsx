export function TrendChart({
  trend,
  label = "Responses received over the last seven days"
}: {
  trend: Array<{ date: string; count: number }>;
  label?: string;
}) {
  const maximum = Math.max(1, ...trend.map((point) => point.count));

  return (
    <div className="trend-chart" aria-label={label}>
      {trend.map((point) => (
        <div className="trend-column" key={point.date}>
          <span className="trend-count">{point.count}</span>
          <span
            className="trend-bar"
            style={{
              height: `${Math.max(point.count ? 12 : 3, (point.count / maximum) * 100)}%`
            }}
          />
          <small>
            {new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
              new Date(`${point.date}T00:00:00Z`)
            )}
          </small>
        </div>
      ))}
    </div>
  );
}
