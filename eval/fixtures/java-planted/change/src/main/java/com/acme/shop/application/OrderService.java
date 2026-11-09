package com.acme.shop.application;

import org.springframework.transaction.annotation.Transactional;

@Transactional
public class OrderService {
  public void place(String orderId) {
    System.out.println("placing " + orderId);
  }
}
