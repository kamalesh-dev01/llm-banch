export default function MetricRow({
  label,
  value,
  percent,
  colorByValue,
  thresholds = [50, 80],
  forceColor = null
}) {
  // Color: green below first threshold,
  //        amber between thresholds,
  //        red above second threshold
  let color = '#3cb080'
  if (forceColor === 'green') {
    color = '#3cb080'
  } else if (colorByValue >= thresholds[1]) {
    color = '#d06050'
  } else if (colorByValue >= thresholds[0]) {
    color = '#e0a040'
  }

  const clampedPct = Math.min(Math.max(percent || 0, 0), 100)

  return (
    <div className="flex items-center gap-1.5 mb-1">
      {/* Label */}
      <span className="text-[10px] text-[#6a6a72] w-8 flex-shrink-0
                       font-mono">
        {label}
      </span>

      {/* Bar */}
      <div className="flex-1 h-1 bg-[rgba(255,255,255,0.06)]
                      rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${clampedPct}%`, backgroundColor: color }}
        />
      </div>

      {/* Value */}
      <span
        className="text-[10px] font-mono w-14 text-right flex-shrink-0"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  )
}
