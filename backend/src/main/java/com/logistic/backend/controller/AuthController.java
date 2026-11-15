package com.logistic.backend.controller;

import com.logistic.backend.dto.AdminResponse;
import com.logistic.backend.dto.LoginRequest;
import com.logistic.backend.dto.LoginResponse;
import com.logistic.backend.service.AuthService;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request) {
        return authService.login(request);
    }

    @PostMapping("/logout")
    public Map<String, String> logout(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        authService.logout(authorization);
        return Map.of("message", "Logged out successfully");
    }

    @GetMapping("/me")
    public AdminResponse currentAdmin(
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization
    ) {
        return authService.getCurrentAdmin(authorization);
    }
}
