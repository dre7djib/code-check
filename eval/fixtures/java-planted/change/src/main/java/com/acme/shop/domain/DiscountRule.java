package com.acme.shop.domain;

public class DiscountRule {
  public Price apply(Price price, int loyaltyYears) {
    if (loyaltyYears >= 5) {
      return new Price(price.cents() * 80 / 100);
    }
    if (loyaltyYears >= 2) {
      return new Price(price.cents() * 90 / 100);
    }
    return price;
  }
}
