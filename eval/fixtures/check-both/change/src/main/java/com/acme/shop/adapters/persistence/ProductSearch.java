package com.acme.shop.adapters.persistence;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class ProductSearch {
  private final Connection connection;

  public ProductSearch(Connection connection) {
    this.connection = connection;
  }

  public ResultSet byName(String name) throws SQLException {
    Statement st = connection.createStatement();
    return st.executeQuery("SELECT * FROM product WHERE name = '" + name + "'");
  }
}
