package com.acme.shop.adapters.persistence;

import com.acme.shop.domain.OrderRepository;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class InMemoryOrderRepository implements OrderRepository {
  private final Map<String, String> statuses = new HashMap<>();

  @Override
  public Optional<String> findStatus(String orderId) {
    return Optional.ofNullable(statuses.get(orderId));
  }

  @Override
  public void save(String orderId, String status) {
    statuses.put(orderId, status);
  }
}
