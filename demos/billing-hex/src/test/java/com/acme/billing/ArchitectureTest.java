package com.acme.billing;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

@AnalyzeClasses(packages = "com.acme.billing")
class ArchitectureTest {
  @ArchTest
  static final ArchRule domain_does_not_depend_on_frameworks =
      noClasses()
          .that().resideInAPackage("com.acme.billing.domain..")
          .should().dependOnClassesThat()
          .resideInAnyPackage("org.springframework..", "jakarta.persistence..", "javax.persistence..");

  @ArchTest
  static final ArchRule application_does_not_depend_on_adapters =
      noClasses()
          .that().resideInAPackage("com.acme.billing.application..")
          .should().dependOnClassesThat()
          .resideInAPackage("com.acme.billing.adapters..");
}
