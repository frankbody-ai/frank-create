import { assertEquals } from "jsr:@std/assert@1";
import { inRequestedOrder, referenceKey, uniqueReferenceUrls } from "./refs.ts";

const base = "https://core.supabase.co/storage/v1/object/sign/studio-images";

Deno.test("the app's link and the server's link to one file count once, the server's wins", () => {
  const app = [`${base}/u/s/a.png?token=old-a`, `${base}/u/s/b.png?token=old-b`];
  const server = [`${base}/u/s/a.png?token=new-a`, `${base}/u/s/b.png?token=new-b`];
  assertEquals(uniqueReferenceUrls([...app, ...server]), [
    `${base}/u/s/a.png?token=new-a`,
    `${base}/u/s/b.png?token=new-b`,
  ]);
});

Deno.test("order follows the first time each image is seen", () => {
  const urls = [`${base}/u/s/b.png?token=1`, "https://cdn.example/x.png", `${base}/u/s/a.png?token=2`, `${base}/u/s/b.png?token=3`];
  assertEquals(uniqueReferenceUrls(urls), [`${base}/u/s/b.png?token=3`, "https://cdn.example/x.png", `${base}/u/s/a.png?token=2`]);
});

Deno.test("different files stay apart, and links outside storage are their own key", () => {
  assertEquals(referenceKey(`${base}/u/s/a%20b.png?token=1`), "storage:studio-images/u/s/a b.png");
  assertEquals(referenceKey("https://cdn.example/x.png?v=1"), "https://cdn.example/x.png?v=1");
  assertEquals(uniqueReferenceUrls([`${base}/u/s/a.png?token=1`, `${base}/u/s/c.png?token=1`]).length, 2);
});

Deno.test("rows come back in the order asked for, missing ids skipped", () => {
  const rows = [{ id: "c" }, { id: "a" }];
  assertEquals(inRequestedOrder(["a", "b", "c", "a"], rows), [{ id: "a" }, { id: "c" }]);
});
