package com.acme.shop.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.junit.jupiter.api.Test;

class PriceTest {
  @Test
  void plusAddsCents() {
    assertEquals(300, new Price(100).plus(new Price(200)).cents());
  }
}
