The resource index: a `FilterBar` over a `DataTable` inside a `Card padding="none"`, with `Pagination` in the footer. This trio is the most-used screen shape in the product.

```jsx
<Card padding="none">
  <FilterBar views={['All','Active','Failing']} selectedView={view} onSelectView={setView}
             searchValue={q} onSearchChange={setQ} />
  <DataTable
    selectable selectedIds={sel} onToggleRow={toggle} onToggleAll={toggleAll}
    columns={[{key:'name',title:'Workflow'},{key:'status',title:'Status'},{key:'runs',title:'Runs',align:'end'}]}
    rows={[{id:'wf_1', name:<Stack direction="inline" gap="300" align="center"><Thumbnail size="medium"/><Text>Invoice triage</Text></Stack>,
            status:<Badge tone="success">Active</Badge>, runs:'1,044'}]}
    footer={<Pagination label="1–50 of 1,044" hasNext />}
  />
</Card>
```

Rows are 52px with 6px cell padding and a 40×40 thumbnail; the checkbox column is fixed at 44px. Numeric columns right-align with tabular figures, and a zero or failing value renders in critical text.
Row hover is `#F7F7F7`; selection is a separate persistent state, not hover.
