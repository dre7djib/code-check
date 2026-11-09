export function selectBySku(sku: string): string {
  return "SELECT id, name FROM product WHERE sku = '" + sku + "'";
}
