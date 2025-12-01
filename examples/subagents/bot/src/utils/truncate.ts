/**
 * Smart truncation for objects/arrays to show in step messages
 * Preserves key info while reducing noise
 */

type TruncateOptions = {
  maxArrayItems?: number;      // Show first N items, then "[+X more]"
  maxStringLength?: number;    // Truncate long strings
  maxDepth?: number;           // Max nesting depth
  maxKeys?: number;            // Max object keys to show
};

const defaults: TruncateOptions = {
  maxArrayItems: 2,
  maxStringLength: 50,
  maxDepth: 2,
  maxKeys: 4,
};

/**
 * Truncate a value for display
 *
 * @example
 * truncate([1,2,3,4,5]) // "[1, 2, +3 more]"
 * truncate({a:1, b:2, c:3, d:4, e:5}) // "{a:1, b:2, c:3, d:4, +1 more}"
 * truncate({systems: [{name:"Email"}, {name:"VPN"}, ...]}) // "{systems:[2 items]}"
 */
export function truncate(value: any, options: TruncateOptions = {}, depth = 0): string {
  const opts = { ...defaults, ...options };

  // Null/undefined
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  // Max depth reached
  if (depth >= (opts.maxDepth ?? 2)) {
    if (Array.isArray(value)) return `[${value.length} items]`;
    if (typeof value === "object") return `{${Object.keys(value).length} keys}`;
  }

  // Arrays
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const max = opts.maxArrayItems ?? 2;
    const items = value.slice(0, max).map((v) => truncate(v, opts, depth + 1));
    const remaining = value.length - max;
    if (remaining > 0) {
      return `[${items.join(", ")}, +${remaining} more]`;
    }
    return `[${items.join(", ")}]`;
  }

  // Objects
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    const max = opts.maxKeys ?? 4;
    const entries = keys.slice(0, max).map((k) => `${k}:${truncate(value[k], opts, depth + 1)}`);
    const remaining = keys.length - max;
    if (remaining > 0) {
      return `{${entries.join(", ")}, +${remaining} more}`;
    }
    return `{${entries.join(", ")}}`;
  }

  // Strings
  if (typeof value === "string") {
    const max = opts.maxStringLength ?? 50;
    if (value.length > max) {
      return `"${value.slice(0, max)}..."`;
    }
    return `"${value}"`;
  }

  // Numbers, booleans
  return String(value);
}

/**
 * Stringify with truncation (like JSON.stringify but truncated)
 */
export function truncateJson(value: any, options?: TruncateOptions): string {
  return truncate(value, options);
}
