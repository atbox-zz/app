package com.mahjong.controller;

import com.mahjong.model.User;
import com.mahjong.repository.UserRepository;
import com.mahjong.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/user")
public class UserController {

    private final UserRepository userRepo;

    public UserController(UserRepository userRepo) {
        this.userRepo = userRepo;
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(@AuthenticationPrincipal User user) {
        if (user == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(AuthService.toDto(user));
    }

    @PutMapping("/me")
    public ResponseEntity<?> updateProfile(@AuthenticationPrincipal User user,
                                            @RequestBody Map<String, String> body) {
        if (body.containsKey("username")) user.setUsername(body.get("username"));
        if (body.containsKey("avatarUrl")) user.setAvatarUrl(body.get("avatarUrl"));
        userRepo.save(user);
        return ResponseEntity.ok(AuthService.toDto(user));
    }

    @PostMapping("/status")
    public ResponseEntity<?> updateStatus(@AuthenticationPrincipal User user,
                                           @RequestBody Map<String, String> body) {
        try {
            user.setStatus(User.Status.valueOf(body.get("status")));
            userRepo.save(user);
            return ResponseEntity.ok().build();
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid status"));
        }
    }
}
