package com.logistic.backend.repository;

import com.logistic.backend.entity.Admin;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AdminRepository extends JpaRepository<Admin, Long> {
    Optional<Admin> findByUsernameIgnoreCase(String username);
    Optional<Admin> findByEmailIgnoreCase(String email);
}
