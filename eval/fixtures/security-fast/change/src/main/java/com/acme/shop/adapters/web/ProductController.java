package com.acme.shop.adapters.web;

import com.acme.shop.adapters.persistence.ProductSearch;
import java.sql.ResultSet;
import java.sql.SQLException;

public class ProductController {
  private final ProductSearch search;

  public ProductController(ProductSearch search) {
    this.search = search;
  }

  // GET /products?name=...
  public ResultSet find(String nameParam) throws SQLException {
    return search.byName(nameParam);
  }
}
