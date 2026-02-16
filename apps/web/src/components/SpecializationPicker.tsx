import { useMemo, useState } from 'react';
import {
  DOCTOR_SPECIALIZATIONS,
  MAX_DOCTOR_SPECIALIZATIONS,
} from '../constants/doctorSpecializations';
import styles from './SpecializationPicker.module.css';

type SpecializationPickerProps = {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
};

export function SpecializationPicker({ value, onChange, disabled = false }: SpecializationPickerProps) {
  const [selectedOption, setSelectedOption] = useState('');

  const availableOptions = useMemo(
    () => DOCTOR_SPECIALIZATIONS.filter((item) => !value.includes(item)),
    [value],
  );

  function addSpecialization(): void {
    if (!selectedOption || value.includes(selectedOption) || value.length >= MAX_DOCTOR_SPECIALIZATIONS) {
      return;
    }
    onChange([...value, selectedOption]);
    setSelectedOption('');
  }

  function removeSpecialization(item: string): void {
    onChange(value.filter((specialization) => specialization !== item));
  }

  return (
    <div className={styles.container}>
      <div className={styles.controls}>
        <select
          className={styles.select}
          value={selectedOption}
          disabled={disabled || value.length >= MAX_DOCTOR_SPECIALIZATIONS || availableOptions.length === 0}
          onChange={(event) => setSelectedOption(event.target.value)}
        >
          <option value="">Select specialization</option>
          {availableOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <button
          className={styles.addButton}
          type="button"
          disabled={disabled || !selectedOption || value.length >= MAX_DOCTOR_SPECIALIZATIONS}
          onClick={addSpecialization}
        >
          Add
        </button>
      </div>
      <p className={styles.helper}>
        Selected: {value.length}/{MAX_DOCTOR_SPECIALIZATIONS}
      </p>
      <div className={styles.chips}>
        {value.map((item) => (
          <button
            key={item}
            type="button"
            className={styles.chip}
            disabled={disabled}
            onClick={() => removeSpecialization(item)}
            aria-label={`Remove ${item}`}
          >
            {item} (remove)
          </button>
        ))}
      </div>
    </div>
  );
}
