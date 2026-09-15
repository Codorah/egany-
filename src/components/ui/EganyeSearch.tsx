import React, { useState, useRef, useEffect } from 'react';
import { EganyeIcon } from './EganyeIcon';

interface EganyeSearchProps {
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  className?: string;
  autoFocus?: boolean;
}

/**
 * EganyeSearch — Unified search component for the entire app.
 * Consistent style: Eganyé icon, rounded, warm, clear button, loading/empty states.
 */
export function EganyeSearch({
  value: controlledValue,
  onChange,
  onSubmit,
  placeholder = 'Rechercher…',
  loading = false,
  className = '',
  autoFocus = false,
}: EganyeSearchProps) {
  const [internalValue, setInternalValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const value = controlledValue !== undefined ? controlledValue : internalValue;

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setInternalValue(v);
    onChange?.(v);
  };

  const handleClear = () => {
    setInternalValue('');
    onChange?.('');
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit?.(value);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative flex items-center ${className}`}
    >
      <div className="absolute left-3.5 text-muted-foreground pointer-events-none">
        {loading ? (
          <div className="w-[18px] h-[18px] border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
        ) : (
          <EganyeIcon name="search" size={18} />
        )}
      </div>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        className="w-full h-12 pl-11 pr-10 rounded-2xl bg-card border border-border text-foreground text-sm font-medium placeholder:text-muted-foreground/60 focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-3.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer p-0.5"
          aria-label="Effacer"
        >
          <EganyeIcon name="close" size={16} />
        </button>
      )}
    </form>
  );
}
