export function SmallScreenNotice() {
  return (
    <div className="small-screen-notice" role="dialog" aria-modal="true" aria-live="polite">
      <div className="small-screen-notice-card">
        <span className="small-screen-notice-eyebrow">art-ificial studio</span>
        <h2>Not ready for phones yet</h2>
        <p>
          The studio needs a wider screen for now. A mobile experience is coming soon — in the
          meantime, open it on a tablet in landscape, a laptop, or a desktop.
        </p>
        <span className="small-screen-notice-foot">autosolutions | OS</span>
      </div>
    </div>
  );
}
