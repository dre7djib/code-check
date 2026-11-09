import { Money } from "../Money";

export function discountFor(quantity: number, unit: Money): Money {
  if (quantity >= 10) {
    return new Money(Math.floor(unit.cents * quantity * 0.9), unit.currency);
  }
  return new Money(unit.cents * quantity, unit.currency);
}
