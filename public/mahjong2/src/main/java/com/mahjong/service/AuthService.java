package com.mahjong.service;

import com.mahjong.model.User;
import com.mahjong.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Random;

@Service
public class AuthService {

    private final UserRepository userRepo;
    private final PasswordEncoder encoder;
    private final JwtService jwt;

    public AuthService(UserRepository userRepo, PasswordEncoder encoder, JwtService jwt) {
        this.userRepo = userRepo;
        this.encoder  = encoder;
        this.jwt      = jwt;
    }

    // ── Records for request/response ─────────────────────────────────
    public record RegisterRequest(String username, String email, String password) {}
    public record LoginRequest(String email, String password) {}
    public record PhoneRequest(String phone) {}
    public record OtpRequest(String phone, String otp) {}
    public record AuthResponse(String token, String refreshToken, UserDto user) {}
    public record UserDto(String id, String username, String email, String phone,
                          String avatarUrl, int score, double winRate, int totalGames) {}

    // ── Email / Password ──────────────────────────────────────────────
    public AuthResponse register(RegisterRequest req) {
        if (userRepo.existsByEmail(req.email()))
            throw new IllegalArgumentException("Email 已被使用");

        var user = new User();
        user.setEmail(req.email());
        user.setUsername(req.username());
        user.setPasswordHash(encoder.encode(req.password()));
        user.setProvider(User.AuthProvider.LOCAL);
        user.setLastLoginAt(Instant.now());
        userRepo.save(user);

        return buildResponse(user);
    }

    public AuthResponse login(LoginRequest req) {
        var user = userRepo.findByEmail(req.email())
            .orElseThrow(() -> new IllegalArgumentException("帳號或密碼錯誤"));
        if (!encoder.matches(req.password(), user.getPasswordHash()))
            throw new IllegalArgumentException("帳號或密碼錯誤");

        user.setLastLoginAt(Instant.now());
        user.setStatus(User.Status.ONLINE);
        userRepo.save(user);
        return buildResponse(user);
    }

    // ── Phone OTP ─────────────────────────────────────────────────────
    public String sendOtp(String phone) {
        // Production: integrate Twilio / AWS SNS here
        String otp = String.format("%06d", new Random().nextInt(999999));
        var user = userRepo.findByPhone(phone).orElseGet(() -> {
            var u = new User();
            u.setPhone(phone);
            u.setUsername("玩家_" + phone.substring(phone.length() - 4));
            u.setProvider(User.AuthProvider.PHONE);
            return u;
        });
        user.setOtpCode(otp);
        user.setOtpExpiry(Instant.now().plusSeconds(300)); // 5 min
        userRepo.save(user);

        // TODO: send SMS via Twilio
        System.out.println("📱 OTP for " + phone + ": " + otp); // dev only
        return "OTP 已發送";
    }

    public AuthResponse verifyOtp(OtpRequest req) {
        var user = userRepo.findByPhone(req.phone())
            .orElseThrow(() -> new IllegalArgumentException("手機號碼不存在"));

        if (!req.otp().equals(user.getOtpCode()))
            throw new IllegalArgumentException("驗證碼錯誤");
        if (Instant.now().isAfter(user.getOtpExpiry()))
            throw new IllegalArgumentException("驗證碼已過期");

        user.setOtpCode(null);
        user.setOtpExpiry(null);
        user.setLastLoginAt(Instant.now());
        user.setStatus(User.Status.ONLINE);
        userRepo.save(user);
        return buildResponse(user);
    }

    // ── OAuth2 (called after success) ─────────────────────────────────
    public AuthResponse processOAuth2(String providerId, User.AuthProvider provider,
                                       String email, String name, String avatarUrl) {
        var user = userRepo.findByProviderIdAndProvider(providerId, provider)
            .orElseGet(() -> {
                // Check if email already exists (merge accounts)
                return userRepo.findByEmail(email).orElseGet(() -> {
                    var u = new User();
                    u.setEmail(email);
                    u.setUsername(name);
                    u.setAvatarUrl(avatarUrl);
                    u.setProviderId(providerId);
                    u.setProvider(provider);
                    return u;
                });
            });

        user.setAvatarUrl(avatarUrl);
        user.setLastLoginAt(Instant.now());
        user.setStatus(User.Status.ONLINE);
        userRepo.save(user);
        return buildResponse(user);
    }

    // ── Token refresh ─────────────────────────────────────────────────
    public AuthResponse refreshToken(String refreshToken) {
        if (!jwt.isValid(refreshToken))
            throw new IllegalArgumentException("Token 無效");
        var userId = jwt.extractUserId(refreshToken);
        var user   = userRepo.findById(userId)
            .orElseThrow(() -> new IllegalArgumentException("使用者不存在"));
        return buildResponse(user);
    }

    // ── Helpers ───────────────────────────────────────────────────────
    private AuthResponse buildResponse(User user) {
        var token   = jwt.generateToken(user.getId(), user.getUsername());
        var refresh = jwt.generateRefreshToken(user.getId());
        return new AuthResponse(token, refresh, toDto(user));
    }

    public static UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getUsername(), u.getEmail(), u.getPhone(),
            u.getAvatarUrl(), u.getScore(), u.getWinRate(), u.getTotalGames());
    }
}
