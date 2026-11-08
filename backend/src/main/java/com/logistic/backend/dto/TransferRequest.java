package com.logistic.backend.dto;

import java.util.List;

public record TransferRequest(String code, String createdBy, List<Item> items) {
    public record Item(Long productId, Long sourceLocationId, Long destinationLocationId, Integer quantity) {}
}
