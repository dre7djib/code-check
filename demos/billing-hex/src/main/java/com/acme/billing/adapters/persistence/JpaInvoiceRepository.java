package com.acme.billing.adapters.persistence;

import com.acme.billing.domain.Invoice;
import com.acme.billing.domain.InvoiceId;
import com.acme.billing.domain.InvoiceRepository;
import com.acme.billing.domain.Money;
import jakarta.persistence.EntityManager;

public final class JpaInvoiceRepository implements InvoiceRepository {
  private final EntityManager entities;

  public JpaInvoiceRepository(EntityManager entities) {
    this.entities = entities;
  }

  @Override
  public Invoice find(InvoiceId id) {
    InvoiceEntity entity = entities.find(InvoiceEntity.class, id.value());
    if (entity == null) {
      throw new IllegalArgumentException("unknown invoice");
    }
    return Invoice.open(new InvoiceId(entity.getId()), new Money(entity.getCents(), entity.getCurrency()));
  }

  @Override
  public void save(Invoice invoice) {
    InvoiceEntity entity = new InvoiceEntity();
    entity.setId(invoice.id().value());
    entity.setCents(invoice.amount().cents());
    entity.setCurrency(invoice.amount().currency());
    entities.merge(entity);
  }
}
