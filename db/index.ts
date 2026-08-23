export function getDb(): never {
  throw new Error(
    "Persistent database is not configured in this deployment. The order API will use its local fallback until a database provider is connected."
  );
}
