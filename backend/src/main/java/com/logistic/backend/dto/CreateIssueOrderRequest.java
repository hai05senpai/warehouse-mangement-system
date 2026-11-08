package com.logistic.backend.dto;

import lombok.Data;
import java.util.List;

@Data
public class CreateIssueOrderRequest {
    private String code;
    private Long customerId;
    private String createdBy;
    private List<IssueItemRequest> items;
}