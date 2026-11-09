package com.acme.billing.adapters.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;

@Entity
public class InvoiceEntity {
  @Id
  private String id;
  private long cents;
  private String currency;

  public String getId() {
    return id;
  }

  public void setId(String id) {
    this.id = id;
  }

  public long getCents() {
    return cents;
  }

  public void setCents(long cents) {
    this.cents = cents;
  }

  public String getCurrency() {
    return currency;
  }

  public void setCurrency(String currency) {
    this.currency = currency;
  }
}
