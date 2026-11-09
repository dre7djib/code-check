export class Money {
  constructor(
    readonly cents: number,
    readonly currency: string,
  ) {
    if (currency.length !== 3) {
      throw new Error("currency");
    }
  }

  plus(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error("currency mismatch");
    }
    return new Money(this.cents + other.cents, this.currency);
  }
}
