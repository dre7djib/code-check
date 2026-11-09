import { Money } from "../../domain/Money";
import { Product } from "../../domain/Product";
import { PublishProduct } from "../../application/PublishProduct";

export class ProductRouter {
  constructor(private readonly publishProduct: PublishProduct) {}

  create(raw: string): string {
    try {
      const body = JSON.parse(raw) as { id: string; sku: string; cents: number };
      const product = new Product(body.id, body.sku, new Money(body.cents, "EUR"));
      this.publishProduct.publish(product);
      return "created";
    } catch {
    }
    return "error";
  }
}
