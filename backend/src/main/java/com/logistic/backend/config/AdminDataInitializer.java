package com.logistic.backend.config;

import com.logistic.backend.entity.Admin;
import com.logistic.backend.repository.AdminRepository;
import com.logistic.backend.service.AuthService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class AdminDataInitializer implements CommandLineRunner {
    private final AdminRepository admins;

    public AdminDataInitializer(AdminRepository admins) {
        this.admins = admins;
    }

    @Override
    public void run(String... args) {
        if (admins.count() > 0) {
            return;
        }
        String defaultHash = AuthService.hashPassword("admin123");
        admins.saveAll(List.of(
                Admin.builder()
                        .username("admin")
                        .passwordHash(defaultHash)
                        .fullName("Nguyễn Quản Trị")
                        .email("admin@stockroom.vn")
                        .phone("0901234567")
                        .role("SUPER_ADMIN")
                        .active(true)
                        .build(),
                Admin.builder()
                        .username("manager")
                        .passwordHash(defaultHash)
                        .fullName("Trần Quản Lý Kho")
                        .email("manager@stockroom.vn")
                        .phone("0902345678")
                        .role("WAREHOUSE_MANAGER")
                        .active(true)
                        .build()
        ));
    }
}
