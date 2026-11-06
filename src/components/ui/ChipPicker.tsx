import React from 'react';

interface ChipPickerProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export function ChipPicker({ options, value, onChange, ariaLabel }: ChipPickerProps) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`min-h-11 px-4 rounded-xl text-sm font-bold border transition-colors cursor-pointer ${
            value === opt.value
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-card text-foreground border-border hover:bg-muted/60'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
