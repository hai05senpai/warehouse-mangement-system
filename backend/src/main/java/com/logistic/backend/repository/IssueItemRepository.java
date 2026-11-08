package com.logistic.backend.repository;

import com.logistic.backend.entity.IssueItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface IssueItemRepository extends JpaRepository<IssueItem, Long> {
    List<IssueItem> findByIssueOrderId(Long issueOrderId);
    @Query("select i from IssueItem i where i.issueOrder.id = :id order by i.product.id, i.location.id")
    List<IssueItem> findOrderedByIssueOrderId(@Param("id") Long issueOrderId);
}