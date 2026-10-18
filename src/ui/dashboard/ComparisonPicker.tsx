interface ComparisonPickerProps {
  comparisonDate: string;
  quickDays: string;
  onPreset(days: number): void;
  onDateChange(date: string): void;
}

const PRESETS = [7, 30, 90];

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

export function ComparisonPicker({
  comparisonDate,
  quickDays,
  onPreset,
  onDateChange,
}: ComparisonPickerProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border p-4">
      <span className="text-sm font-medium">Compare prices with</span>
      {PRESETS.map((days) => (
        <button
          key={days}
          type="button"
          aria-pressed={quickDays === String(days)}
          className={`rounded-md border px-3 py-1.5 text-sm ${
            quickDays === String(days)
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          }`}
          onClick={() => onPreset(days)}
        >
          {days} days
        </button>
      ))}
      <label className="flex items-center gap-2 text-sm">
        Choose date
        <input
          aria-label="Comparison date"
          type="date"
          min="1000-01-01"
          max={utcToday()}
          value={comparisonDate}
          onChange={(event) => onDateChange(event.target.value)}
          className="rounded-md border bg-background px-2 py-1.5"
        />
      </label>
      <span className="text-xs text-muted-foreground">Dates in UTC</span>
    </div>
  );
}
