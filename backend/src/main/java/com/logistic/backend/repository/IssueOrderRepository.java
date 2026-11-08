package com.logistic.backend.repository;

import com.logistic.backend.entity.IssueOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

import java.util.Optional;

@Repository
public interface IssueOrderRepository extends JpaRepository<IssueOrder, Long> {
    @Query("select o from IssueOrder o join fetch o.customer order by o.issueDate desc")
    List<IssueOrder> findAllWithCustomer();
    
    // THÊM HÀM NÀY ĐỂ KHÓA DÒNG ĐƠN HÀNG (PESSIMISTIC LOCK)
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT o FROM IssueOrder o WHERE o.id = :id")
    Optional<IssueOrder> findByIdWithLock(@Param("id") Long id);
}