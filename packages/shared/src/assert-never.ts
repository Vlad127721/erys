/**
 * Marks a branch that must be unreachable. Used as the `default` of a switch over a union:
 * adding a member to the union makes the call a compile error until the new case is handled.
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
