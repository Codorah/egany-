import React from 'react';

interface ChipPickerProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

export function ChipPicker({ options, value, onChange, ariaLabel }: ChipPickerProps) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
            value === opt.value
              ? 'bg-[#C96F4A] text-white border-[#C96F4A]'
              : 'bg-white dark:bg-card text-foreground border-border hover:bg-muted/60'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
