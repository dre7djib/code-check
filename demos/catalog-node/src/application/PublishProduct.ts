import { Product } from "../domain/Product";
import type { ProductRepository } from "../domain/ProductRepository";

export class PublishProduct {
  constructor(private readonly products: ProductRepository) {}

  publish(product: Product): Product {
    this.products.save(product);
    return product;
  }
}
