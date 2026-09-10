import React from 'react';
import { Checkbox } from '../forms/Checkbox.jsx';

/**
 * Dense resource table: 52px rows, 6px cell padding, hairline dividers,
 * 44px checkbox column, numeric columns right-aligned.
 */
export function DataTable({
  columns = [], rows = [], selectable = false, selectedIds = [], onToggleRow, onToggleAll,
  onRowClick, footer, className = '', style, ...rest
}) {
  const allSelected = selectable && rows.length > 0 && selectedIds.length === rows.length;
  const someSelected = selectable && selectedIds.length > 0 && !allSelected;
  return (
    <div className={['as-table-wrap', className].filter(Boolean).join(' ')} style={style}>
      <table className="as-table" {...rest}>
        <thead>
          <tr>
            {selectable && (
              <th className="as-table__check">
                <Checkbox checked={allSelected} indeterminate={someSelected} onChange={() => onToggleAll && onToggleAll(!allSelected)} aria-label="Select all" />
              </th>
            )}
            {columns.map((c) => (
              <th key={c.key} style={{ textAlign: c.align === 'end' ? 'right' : 'left', width: c.width }}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedIds.includes(row.id);
            return (
              <tr
                key={row.id}
                className={selected ? 'is-selected' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                style={onRowClick ? { cursor: 'pointer' } : undefined}
              >
                {selectable && (
                  <td className="as-table__check" onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={selected} onChange={() => onToggleRow && onToggleRow(row.id)} aria-label={`Select ${row.id}`} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c.key} className={c.align === 'end' ? 'as-tabular' : undefined} style={{ textAlign: c.align === 'end' ? 'right' : 'left' }}>{row[c.key]}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footer && <div className="as-table__footer">{footer}</div>}
    </div>
  );
}
