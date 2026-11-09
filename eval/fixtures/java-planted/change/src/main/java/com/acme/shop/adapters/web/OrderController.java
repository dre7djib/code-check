package com.acme.shop.adapters.web;

import com.acme.shop.application.OrderService;

public class OrderController {
  private final OrderService service = new OrderService();

  public String place(String orderId) {
    try {
      service.place(orderId);
      return "placed";
    } catch (Exception e) {
    }
    return "error";
  }
}
