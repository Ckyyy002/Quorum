import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

/** Label + control + inline error, wired with aria so screen readers announce the error. */
export function FormField(props: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={props.id}>{props.label}</Label>
      {props.children}
      {props.error ? (
        <p id={`${props.id}-error`} className="text-sm text-destructive">
          {props.error}
        </p>
      ) : props.hint ? (
        <p id={`${props.id}-hint`} className="text-xs text-muted-foreground">
          {props.hint}
        </p>
      ) : null}
    </div>
  );
}
