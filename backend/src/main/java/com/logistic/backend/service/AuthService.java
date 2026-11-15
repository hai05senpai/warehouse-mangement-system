package com.logistic.backend.service;

import com.logistic.backend.dto.AdminResponse;
import com.logistic.backend.dto.LoginRequest;
import com.logistic.backend.dto.LoginResponse;
import com.logistic.backend.entity.Admin;
import com.logistic.backend.repository.AdminRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AuthService {
    private final AdminRepository admins;
    private final Map<String, Long> activeSessions = new ConcurrentHashMap<>();

    public AuthService(AdminRepository admins) {
        this.admins = admins;
    }

    @Transactional
    public LoginResponse login(LoginRequest request) {
        if (request == null || request.username() == null || request.username().isBlank()
                || request.password() == null || request.password().isBlank()) {
            throw new IllegalArgumentException("Username and password are required");
        }

        Admin admin = admins.findByUsernameIgnoreCase(request.username().trim())
                .orElseThrow(() -> new IllegalArgumentException("Invalid username or password"));

        if (!verifyPassword(request.password(), admin.getPasswordHash())) {
            throw new IllegalArgumentException("Invalid username or password");
        }

        if (!Boolean.TRUE.equals(admin.getActive())) {
            throw new IllegalStateException("Admin account is disabled");
        }

        admin.setLastLoginAt(OffsetDateTime.now());
        Admin saved = admins.save(admin);

        String token = UUID.randomUUID().toString();
        activeSessions.put(token, saved.getId());

        return new LoginResponse(token, toResponse(saved));
    }

    public void logout(String token) {
        String normalized = extractToken(token);
        if (normalized != null) {
            activeSessions.remove(normalized);
        }
    }

    @Transactional(readOnly = true)
    public AdminResponse getCurrentAdmin(String token) {
        String normalized = extractToken(token);
        if (normalized == null) {
            throw new IllegalArgumentException("Authentication required");
        }
        Long adminId = activeSessions.get(normalized);
        if (adminId == null) {
            throw new IllegalArgumentException("Invalid or expired session");
        }
        Admin admin = admins.findById(adminId)
                .orElseThrow(() -> new IllegalArgumentException("Admin not found"));
        if (!Boolean.TRUE.equals(admin.getActive())) {
            activeSessions.remove(normalized);
            throw new IllegalStateException("Admin account is disabled");
        }
        return toResponse(admin);
    }

    public static String hashPassword(String rawPassword) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(rawPassword.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 algorithm not available", exception);
        }
    }

    private boolean verifyPassword(String rawPassword, String storedHash) {
        if (storedHash == null || rawPassword == null) {
            return false;
        }
        String hashedInput = hashPassword(rawPassword);
        return hashedInput.equalsIgnoreCase(storedHash) || rawPassword.equals(storedHash);
    }

    private String extractToken(String headerOrToken) {
        if (headerOrToken == null || headerOrToken.isBlank()) {
            return null;
        }
        String trimmed = headerOrToken.trim();
        if (trimmed.regionMatches(true, 0, "Bearer ", 0, 7)) {
            String token = trimmed.substring(7).trim();
            return token.isEmpty() ? null : token;
        }
        return trimmed;
    }

    public AdminResponse toResponse(Admin admin) {
        return new AdminResponse(
                admin.getId(),
                admin.getUsername(),
                admin.getFullName(),
                admin.getEmail(),
                admin.getPhone(),
                admin.getRole(),
                admin.getActive(),
                admin.getLastLoginAt(),
                admin.getCreatedAt()
        );
    }
}
