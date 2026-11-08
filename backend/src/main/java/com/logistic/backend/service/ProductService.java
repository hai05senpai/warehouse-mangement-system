package com.logistic.backend.service;

import com.logistic.backend.dto.ProductRequest;
import com.logistic.backend.entity.Product;
import com.logistic.backend.repository.ProductRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ProductService {
    private final ProductRepository products;

    public ProductService(ProductRepository products) {
        this.products = products;
    }

    public List<Product> list() {
        return products.findAll();
    }

    @Transactional
    public Product create(ProductRequest request) {
        validate(request);
        if (products.findBySku(request.sku().trim()).isPresent()) {
            throw new IllegalArgumentException("SKU already exists");
        }
        return products.save(toProduct(new Product(), request));
    }

    @Transactional
    public Product update(Long id, ProductRequest request) {
        validate(request);
        Product product = products.findById(id).orElseThrow(() -> new IllegalArgumentException("Product not found"));
        products.findBySku(request.sku().trim()).filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> { throw new IllegalArgumentException("SKU already exists"); });
        return products.save(toProduct(product, request));
    }

    @Transactional
    public void deleteUnused(Long id) {
        Product product = products.findById(id).orElseThrow(() -> new IllegalArgumentException("Product not found"));
        if (products.countUsage(id) > 0) {
            throw new IllegalStateException("Product has inventory or transaction history and cannot be deleted");
        }
        products.delete(product);
    }

    private Product toProduct(Product product, ProductRequest request) {
        product.setSku(request.sku().trim());
        product.setName(request.name().trim());
        product.setCategory(request.category());
        product.setUnit(request.unit());
        product.setMinQuantity(request.minQuantity());
        return product;
    }

    private void validate(ProductRequest request) {
        if (request == null || request.sku() == null || request.sku().isBlank()
                || request.name() == null || request.name().isBlank()) {
            throw new IllegalArgumentException("SKU and product name are required");
        }
        if (request.minQuantity() != null && request.minQuantity() < 0) {
            throw new IllegalArgumentException("Minimum quantity cannot be negative");
        }
    }
}
