import { Button, Text } from "../ds";

/**
 * Links to screens that no longer exist — the review board, the cliff access
 * checklist — used to render the Studio instead. A dead link that silently
 * shows you a different screen reads as a broken app, so say what happened.
 */
export function NotFoundPage() {
  return (
    <div className="notfound-page">
      <Text variant="headingLg">That page isn't here any more</Text>
      <Text variant="bodyMd" tone="secondary">
        The link you followed points at a screen that is no longer part of the studio.
      </Text>
      <Button size="large" onClick={() => window.location.replace("/")}>
        Back to Studio
      </Button>
    </div>
  );
}
