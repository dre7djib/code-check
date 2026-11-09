package com.acme.shop.domain.notify;

import org.springframework.stereotype.Service;

@Service
public class OrderNotifier {
  public String message(String orderId) {
    return "order " + orderId;
  }
}
