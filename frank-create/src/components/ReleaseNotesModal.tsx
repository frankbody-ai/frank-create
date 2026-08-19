import React from "react";

import { Button, Modal, Text } from "../ds";
import { RELEASES, markReleasesSeen, unseenReleases, type ReleaseNote } from "../lib/releaseNotes";

/**
 * "What's new" banner. Auto-opens once per release per signed-in user (the seen
 * marker lives in the backend, so it follows them across devices), and can be
 * re-opened on demand from the sidebar.
 */
export function ReleaseNotesModal({
  forceOpen = false,
  onClose,
}: {
  forceOpen?: boolean;
  onClose?: () => void;
}) {
  const [autoOpen, setAutoOpen] = React.useState(false);
  const [notes, setNotes] = React.useState<ReleaseNote[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void unseenReleases().then((unseen) => {
      if (cancelled || !unseen.length) return;
      setNotes(unseen);
      setAutoOpen(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const open = autoOpen || forceOpen;
  const shown = notes.length && autoOpen ? notes : RELEASES.slice(0, 5);

  const close = () => {
    setAutoOpen(false);
    void markReleasesSeen();
    onClose?.();
  };

  if (!open || !shown.length) return null;

  return (
    <Modal
      open
      size="medium"
      title="What's new"
      onClose={close}
      primaryAction={<Button variant="primary" onClick={close}>Got it</Button>}
    >
      <div className="release-notes">
        {shown.map((release) => (
          <section key={release.id} className="release-notes__entry">
            <Text variant="headingMd" as="h3">{release.title}</Text>
            <Text variant="bodySm" tone="secondary">{release.date}</Text>
            <ul className="release-notes__list">
              {release.items.map((item, index) => (
                <li key={index}>
                  <Text variant="bodyMd">{item}</Text>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Modal>
  );
}
