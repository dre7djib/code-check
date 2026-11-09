package com.acme.shop.domain;

public class ShippingRule {
  public Price cost(int weightGrams, boolean express) {
    long base = weightGrams <= 500 ? 400 : 900;
    return new Price(express ? base * 2 : base);
  }
}
