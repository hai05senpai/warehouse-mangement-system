package com.logistic.backend.dto;

import lombok.Data;

@Data
public class IssueItemRequest {
    private Long productId;
    private Long locationId;
    private Integer quantity;
}