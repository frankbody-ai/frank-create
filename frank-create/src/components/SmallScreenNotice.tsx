export function SmallScreenNotice() {
  return (
    <div className="small-screen-notice" role="dialog" aria-modal="true" aria-live="polite">
      <div className="small-screen-notice-card">
        <span className="small-screen-notice-eyebrow">art-ificial studio</span>
        <h2>Desktop only for now</h2>
        <p>
          Tablet and phone apps aren't ready yet — they're coming soon. For now, open the studio
          on a laptop or desktop screen wider than 1024px.
        </p>
        <span className="small-screen-notice-foot">autosolutions | OS</span>
      </div>
    </div>
  );
}
