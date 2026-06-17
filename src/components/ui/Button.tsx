/**
 * Bouton standard du design system ASF.
 *
 * S'appuie sur les classes définies dans index.css (.btn-asf, .btn-sourire,
 * .btn-secondary, .btn-danger, .btn-ghost) pour garantir une apparence
 * cohérente sur toute l'application.
 */

import React from 'react';
import { cn } from '../../lib/utils';

export type ButtonVariant =
  | 'primary' // azur — action principale
  | 'sourire' // orange — dépôt / Ailes du Sourire
  | 'secondary' // contour neutre
  | 'danger' // suppression
  | 'ghost'; // sans fond

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: 'btn-asf',
  sourire: 'btn-sourire',
  secondary: 'btn-secondary',
  danger: 'btn-danger',
  ghost: 'btn-ghost',
};

const SIZE_CLASS = {
  sm: 'text-sm px-3.5 py-2 rounded-xl',
  md: '',
  lg: 'text-base px-7 py-3.5',
} as const;

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: keyof typeof SIZE_CLASS;
  /** Affiche un état de chargement et désactive le bouton. */
  loading?: boolean;
  /** Icône optionnelle placée avant le libellé. */
  icon?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
  children?: React.ReactNode;
  disabled?: boolean;
  /** Attributs HTML natifs supplémentaires (onClick, type, aria-*…). */
  [key: string]: any;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && 'w-full',
        'cursor-pointer disabled:cursor-not-allowed',
        className,
      )}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon
      )}
      {children}
    </button>
  );
}

export default Button;
