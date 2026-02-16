import DatePicker from 'react-datepicker';
import styles from './DateInput.module.css';

type DateInputProps = {
  value: string;
  onChange: (value: string) => void;
  inputClassName?: string;
  placeholder?: string;
  minDate?: Date;
  maxDate?: Date;
  id?: string;
  name?: string;
  disabled?: boolean;
};

function parseIsoDate(value: string): Date | null {
  if (!value) {
    return null;
  }

  const [yearValue, monthValue, dayValue] = value.split('-');
  const year = Number(yearValue);
  const month = Number(monthValue);
  const day = Number(dayValue);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function DateInput({
  value,
  onChange,
  inputClassName,
  placeholder = 'Select date',
  minDate,
  maxDate,
  id,
  name,
  disabled = false,
}: DateInputProps) {
  return (
    <div className={styles.field}>
      <DatePicker
        id={id}
        name={name}
        selected={parseIsoDate(value)}
        onChange={(date: Date | null) => onChange(date ? toIsoDate(date) : '')}
        dateFormat="yyyy-MM-dd"
        placeholderText={placeholder}
        className={inputClassName}
        minDate={minDate}
        maxDate={maxDate}
        disabled={disabled}
        showMonthDropdown
        showYearDropdown
        dropdownMode="select"
        calendarClassName={styles.calendar}
        popperClassName={styles.popper}
      />
    </div>
  );
}
