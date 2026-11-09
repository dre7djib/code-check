package com.acme.shop.domain;

import java.util.Optional;

public interface OrderRepository {
  Optional<String> findStatus(String orderId);

  void save(String orderId, String status);
}
