package com.acme.shop.domain;

public record Price(long cents) {
  public Price {
    if (cents < 0) {
      throw new IllegalArgumentException("negative");
    }
  }

  public Price plus(Price other) {
    return new Price(cents + other.cents);
  }
}
