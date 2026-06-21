/**
 * Champ de saisie du design system ASF.
 *
 * Gère un libellé, un message d'erreur et une icône optionnelle, le tout
 * stylé via la classe `.input-asf` définie dans index.css.
 */

import React, { useId } from 'react';
import { cn } from '../../lib/utils';

export interface InputProps {
  label?: string;
  error?: string;
  hint?: string;
  /** Icône affichée à gauche dans le champ. */
  icon?: React.ReactNode;
  containerClassName?: string;
  className?: string;
  id?: string;
  /** Attributs HTML natifs supplémentaires (value, onChange, type…). */
  [key: string]: any;
}

export function Input({
  label,
  error,
  hint,
  icon,
  className,
  containerClassName,
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            'input-asf',
            icon && 'pl-10',
            error && 'border-rose-400 focus:border-rose-400 focus:ring-rose-200',
            className,
          )}
          aria-invalid={error ? true : undefined}
          {...props}
        />
      </div>
      {error ? (
        <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>
      ) : hint ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

export default Input;
