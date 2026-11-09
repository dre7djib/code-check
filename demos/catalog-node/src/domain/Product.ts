import { Money } from "./Money";

export class Product {
  constructor(
    readonly id: string,
    readonly sku: string,
    readonly price: Money,
  ) {
    if (id.length === 0 || sku.length === 0) {
      throw new Error("product");
    }
  }
}
