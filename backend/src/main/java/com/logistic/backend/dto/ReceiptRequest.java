package com.logistic.backend.dto;

import java.util.List;

public record ReceiptRequest(String code, Long supplierId, String createdBy, List<ReceiptItemRequest> items) {
    public record ReceiptItemRequest(Long productId, Long locationId, Integer quantity) {}
}
