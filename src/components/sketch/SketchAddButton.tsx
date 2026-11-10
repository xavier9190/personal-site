'use client';

import { STANDARD_ADD_BUTTON_LABEL } from '@/config/modules';
import { SketchButton, type SketchButtonProps } from './SketchButton';

export interface SketchAddButtonProps extends Omit<SketchButtonProps, 'children'> {
  label?: string;
}

export function SketchAddButton({
  label = STANDARD_ADD_BUTTON_LABEL,
  variant = 'default',
  ...props
}: SketchAddButtonProps) {
  return (
    <SketchButton
      variant={variant}
      data-testid="module-add-button"
      {...props}
    >
      {label}
    </SketchButton>
  );
}
