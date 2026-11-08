package com.logistic.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateStockTakeRequest {
    private String code;
    private String createdBy;
    private List<StockTakeItemRequest> items;
}