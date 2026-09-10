import React from 'react';
import { IconButton } from '../actions/IconButton.jsx';
import { ButtonGroup } from '../actions/ButtonGroup.jsx';

export function Pagination({ label, hasPrevious = false, hasNext = true, onPrevious, onNext, className = '', style, ...rest }) {
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
