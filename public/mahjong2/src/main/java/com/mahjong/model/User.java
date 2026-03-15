package com.mahjong.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "users")
public class User {

    public enum AuthProvider { LOCAL, GOOGLE, FACEBOOK, PHONE }
    public enum Status { ONLINE, OFFLINE, IN_GAME }

    @Id
    @Column(length = 36)
    private String id = UUID.randomUUID().toString();

    @Column(unique = true, nullable = true)
    @Email
    private String email;

    @Column(nullable = true)
    private String passwordHash;

    @Column(unique = true, nullable = true)
    private String phone;

    @Column(nullable = true)
    private String providerId;       // Google / Facebook user id

    @Enumerated(EnumType.STRING)
    private AuthProvider provider = AuthProvider.LOCAL;

    @Column(nullable = false)
    private String username;

    private String avatarUrl;

    @Enumerated(EnumType.STRING)
    private Status status = Status.OFFLINE;

    private int totalGames;
    private int wins;
    private int score = 30000;

    private Instant createdAt = Instant.now();
    private Instant lastLoginAt;

    // Phone OTP fields
    private String otpCode;
    private Instant otpExpiry;

    // ── Getters / Setters ────────────────────────────────────────────
    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }
    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }
    public String getProviderId() { return providerId; }
    public void setProviderId(String providerId) { this.providerId = providerId; }
    public AuthProvider getProvider() { return provider; }
    public void setProvider(AuthProvider provider) { this.provider = provider; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }
    public Status getStatus() { return status; }
    public void setStatus(Status status) { this.status = status; }
    public int getTotalGames() { return totalGames; }
    public void setTotalGames(int totalGames) { this.totalGames = totalGames; }
    public int getWins() { return wins; }
    public void setWins(int wins) { this.wins = wins; }
    public int getScore() { return score; }
    public void setScore(int score) { this.score = score; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public void setLastLoginAt(Instant lastLoginAt) { this.lastLoginAt = lastLoginAt; }
    public String getOtpCode() { return otpCode; }
    public void setOtpCode(String otpCode) { this.otpCode = otpCode; }
    public Instant getOtpExpiry() { return otpExpiry; }
    public void setOtpExpiry(Instant otpExpiry) { this.otpExpiry = otpExpiry; }

    // Computed
    public double getWinRate() {
        return totalGames == 0 ? 0.0 : (double) wins / totalGames * 100;
    }
}
