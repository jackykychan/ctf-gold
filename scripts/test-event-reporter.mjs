/** Machine-readable reporter for Node's test runner. One JSON object per test. */
export default async function* report(source) {
  for await (const event of source) {
    if (event.type !== "test:pass" && event.type !== "test:fail") continue;
    const data = event.data ?? {};
    const details = data.details ?? {};
    const error = details.error;
    yield `${JSON.stringify({
      status: data.skip ? "skipped" : data.todo ? "todo" : event.type === "test:pass" ? "passed" : "failed",
      name: data.name ?? "Unnamed test",
      file: data.file ?? "",
      durationMs: details.duration_ms ?? 0,
      error: error ? { message: error.message ?? String(error), stack: error.stack ?? "" } : null,
    })}\n`;
  }
}
