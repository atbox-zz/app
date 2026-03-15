package com.mahjong.repository;

import com.mahjong.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, String> {
    Optional<User> findByEmail(String email);
    Optional<User> findByPhone(String phone);
    Optional<User> findByProviderIdAndProvider(String providerId, User.AuthProvider provider);
    boolean existsByEmail(String email);
    boolean existsByPhone(String phone);
}
