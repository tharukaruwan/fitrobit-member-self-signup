import * as React from "react";
import { format, parse, isValid } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/**
 * ── The single date-picker used across the app ───────────────────────────────
 *
 * One popover-calendar control so every date field looks and behaves the same
 * (month/year dropdowns, keyboard focus, disabled ranges).
 *
 * Timezone-safe by construction: it works purely in *local calendar days*. A
 * picked day is the day the user tapped, never shifted by UTC conversion. When
 * you need to send it to the API, serialise with `toDateInputValue(date)`
 * (→ "yyyy-MM-dd") rather than `date.toISOString()`, which would roll the day
 * back for users east of UTC.
 *
 * Two value modes:
 *   - `<DatePicker value={Date} onChange={(d) => …} />`  — Date objects
 *   - `<DatePicker value="2026-07-05" onChange={(s) => …} valueFormat="string" />`
 *     — plain "yyyy-MM-dd" strings (drop-in for old `<input type="date">`)
 */

const DEFAULT_FROM_YEAR = new Date().getFullYear() - 100;
const DEFAULT_TO_YEAR = new Date().getFullYear() + 10;

/** Serialise a picked day as a timezone-stable "yyyy-MM-dd" string. */
export function toDateInputValue(date: Date | null | undefined): string {
  return date && isValid(date) ? format(date, "yyyy-MM-dd") : "";
}

/** Parse a "yyyy-MM-dd" (or ISO) string into a local Date, or undefined. */
export function parseDateInput(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  // Prefer date-only parsing so "2026-07-05" is local midnight, not UTC.
  const dateOnly = parse(value.slice(0, 10), "yyyy-MM-dd", new Date());
  if (isValid(dateOnly)) return dateOnly;
  const fallback = new Date(value);
  return isValid(fallback) ? fallback : undefined;
}

interface DatePickerBaseProps {
  placeholder?: string;
  /** Disable the whole control. */
  disabled?: boolean;
  /** Per-day predicate — return true to disable that day. */
  disabledDates?: (date: Date) => boolean;
  /** Convenience: disable every day after today. */
  disableFuture?: boolean;
  /** Convenience: disable every day before today. */
  disablePast?: boolean;
  fromYear?: number;
  toYear?: number;
  /** Display format for the trigger button (date-fns). Default "MMM d, yyyy". */
  displayFormat?: string;
  className?: string;
  align?: "start" | "center" | "end";
  id?: string;
}

interface DateValueProps extends DatePickerBaseProps {
  valueFormat?: "date";
  value?: Date | null;
  onChange: (date: Date | undefined) => void;
}

interface StringValueProps extends DatePickerBaseProps {
  valueFormat: "string";
  value?: string | null;
  onChange: (value: string) => void;
}

export type DatePickerProps = DateValueProps | StringValueProps;

export function DatePicker(props: DatePickerProps) {
  const {
    placeholder = "Pick a date",
    disabled = false,
    disabledDates,
    disableFuture = false,
    disablePast = false,
    fromYear = DEFAULT_FROM_YEAR,
    toYear = DEFAULT_TO_YEAR,
    displayFormat = "MMM d, yyyy",
    className,
    align = "start",
    id,
  } = props;

  // Normalise the incoming value to a Date regardless of value mode.
  const selected: Date | undefined = React.useMemo(() => {
    if (props.valueFormat === "string") return parseDateInput(props.value);
    return props.value instanceof Date && isValid(props.value) ? props.value : undefined;
  }, [props.valueFormat, props.value]);

  const [open, setOpen] = React.useState(false);

  // Month currently shown by the calendar, kept separate from the selected value
  // so navigating never mutates the picked date and vice-versa.
  const [displayMonth, setDisplayMonth] = React.useState<Date>(selected ?? new Date());

  const emit = (date: Date | undefined) => {
    if (props.valueFormat === "string") {
      props.onChange(date ? toDateInputValue(date) : "");
    } else {
      props.onChange(date);
    }
  };

  const isDayDisabled = React.useCallback(
    (date: Date) => {
      if (disableFuture && date > new Date()) return true;
      if (disablePast) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (date < today) return true;
      }
      return disabledDates ? disabledDates(date) : false;
    },
    [disableFuture, disablePast, disabledDates]
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) setDisplayMonth(selected ?? new Date());
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-10 pl-3 text-left font-normal",
            !selected && "text-muted-foreground",
            className
          )}
        >
          {selected ? format(selected, displayFormat) : <span>{placeholder}</span>}
          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="single"
          captionLayout="dropdown-buttons"
          fromYear={fromYear}
          toYear={toYear}
          selected={selected}
          onSelect={(date) => {
            emit(date);
            if (date) {
              setDisplayMonth(date);
              setOpen(false);
            }
          }}
          month={displayMonth}
          onMonthChange={setDisplayMonth}
          disabled={isDayDisabled}
          initialFocus
          className={cn("p-3 pointer-events-auto")}
        />
      </PopoverContent>
    </Popover>
  );
}
