import React from 'react';
import { IconButton } from '../actions/IconButton';
import { ButtonGroup } from '../actions/ButtonGroup';

export interface PaginationProps extends React.HTMLAttributes<HTMLDivElement> {
  /** e.g. '1–50 of 1,044'. Rendered with tabular figures. */
  label?: React.ReactNode;
  hasPrevious?: boolean;
  hasNext?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function Pagination({ label, hasPrevious = false, hasNext = true, onPrevious, onNext, className = '', style, ...rest }: PaginationProps) {
  return (
    <div className={['as-pagination', className].filter(Boolean).join(' ')} style={style} {...rest}>
      <ButtonGroup variant="segmented">
        <IconButton icon="chevron-left" label="Previous page" variant="secondary" disabled={!hasPrevious} onClick={onPrevious} />
        <IconButton icon="chevron-right" label="Next page" variant="secondary" disabled={!hasNext} onClick={onNext} />
      </ButtonGroup>
      {label && <span className="as-pagination__label as-tabular">{label}</span>}
    </div>
  );
}
