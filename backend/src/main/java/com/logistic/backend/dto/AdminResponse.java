package com.logistic.backend.dto;

import java.time.OffsetDateTime;

public record AdminResponse(
        Long id,
        String username,
        String fullName,
        String email,
        String phone,
        String role,
        Boolean active,
        OffsetDateTime lastLoginAt,
        OffsetDateTime createdAt
) {}
