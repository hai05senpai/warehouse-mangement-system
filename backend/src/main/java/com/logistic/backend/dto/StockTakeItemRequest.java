package com.logistic.backend.dto;

import lombok.Data;

@Data
public class StockTakeItemRequest {
    private Long productId;
    private Long locationId;
    private Integer actualQty;
}