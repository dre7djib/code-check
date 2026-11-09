package com.acme.shop.application;

import com.acme.shop.domain.Price;

public class CheckoutOrder {
  public Price total(Price a, Price b) {
    return a.plus(b);
  }
}
