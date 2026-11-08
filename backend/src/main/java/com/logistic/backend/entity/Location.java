package com.logistic.backend.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "locations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String code; // Ví dụ: A1-R2-S3 (Aisle 1, Rack 2, Shelf 3)

    @Column(nullable = false, length = 50)
    private String zone; // Khu vực: A, B, C...

    @Column(length = 50)
    private String rack; // Kệ

    @Column(length = 50)
    private String shelf; // Tầng
}