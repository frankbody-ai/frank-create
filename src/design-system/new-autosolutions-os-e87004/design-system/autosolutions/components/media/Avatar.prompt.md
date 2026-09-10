Avatar and Thumbnail — the two image slots in the product. Avatar is for people and stores, Thumbnail is for records in a table.

```jsx
<Avatar name="Alex Brody" size={28} />
<Avatar name="Ops bot" tone="seven" size={24} />
<Thumbnail source="/assets/img/run.png" size="medium" />
<Thumbnail />  {/* empty state: photo glyph on a secondary surface */}
```

Avatar picks one of seven palette entries by hashing `name`, so the same person is always the same colour; initials are uppercase at weight 550 and 40% of the box. Radius is the fluid `--radius-avatar` clamp, not a circle.
Thumbnail is 40×40 at radius 8 in table rows — that pairing is fixed across the product.
