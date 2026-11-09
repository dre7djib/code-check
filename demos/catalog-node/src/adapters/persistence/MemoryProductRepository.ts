import { Product } from "../../domain/Product";
import type { ProductRepository } from "../../domain/ProductRepository";

export class MemoryProductRepository implements ProductRepository {
  private readonly rows = new Map<string, Product>();

  find(id: string): Product | undefined {
    return this.rows.get(id);
  }

  save(product: Product): void {
    this.rows.set(product.id, product);
  }
}
