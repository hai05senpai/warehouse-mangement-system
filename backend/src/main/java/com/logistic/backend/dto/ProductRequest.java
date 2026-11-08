package com.logistic.backend.dto;

public record ProductRequest(String sku, String name, String category, String unit, Integer minQuantity) {}
