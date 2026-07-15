/** Output formats supported by the CLI. */
export type OutputFormat = "md" | "json";

/**
 * Resolve the output format from `--format` and the `--json` shorthand.
 *
 * `--json` is exactly equivalent to `--format json`. Passing both is fine as
 * long as they agree; `--json` together with `--format md` is an error.
 */
export function resolveFormat(format: string | undefined, json: boolean): OutputFormat {
  if (format !== undefined && format !== "md" && format !== "json") {
    throw new Error("--format must be md or json");
  }
  if (json && format === "md") {
    throw new Error("--json conflicts with --format md");
  }
  return json ? "json" : (format ?? "md");
}
