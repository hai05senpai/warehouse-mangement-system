package com.logistic.backend.controller;

import com.logistic.backend.entity.Customer;
import com.logistic.backend.entity.Supplier;
import com.logistic.backend.repository.CustomerRepository;
import com.logistic.backend.repository.SupplierRepository;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api")
public class ReferenceDataController {
    private final CustomerRepository customers;
    private final SupplierRepository suppliers;
    public ReferenceDataController(CustomerRepository customers, SupplierRepository suppliers) {
        this.customers = customers; this.suppliers = suppliers;
    }
    @GetMapping("/customers") public List<Customer> customers() { return customers.findAll(); }
    @GetMapping("/suppliers") public List<Supplier> suppliers() { return suppliers.findAll(); }
}
