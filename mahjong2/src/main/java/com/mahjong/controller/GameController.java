package com.mahjong.controller;

import com.mahjong.model.*;
import com.mahjong.repository.GameRoomRepository;
import com.mahjong.repository.UserRepository;
import com.mahjong.service.GameService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/game")
@CrossOrigin(origins = "*")
public class GameController {

    private final GameService gameService;
    private final GameRoomRepository roomRepo;
    private final UserRepository userRepo;

    public GameController(GameService gameService, GameRoomRepository roomRepo,
                          UserRepository userRepo) {
        this.gameService = gameService;
        this.roomRepo    = roomRepo;
        this.userRepo    = userRepo;
    }

    // ── Single player ──────────────────────────────────────────────────
    @PostMapping("/start")
    public ResponseEntity<GameState> startSingle(@AuthenticationPrincipal User user,
                                                  @RequestBody Map<String, Integer> params) {
        int aiLevel     = params.getOrDefault("aiLevel", 2);
        int totalRounds = params.getOrDefault("totalRounds", 4);
        String userId   = user != null ? user.getId() : "p0";
        String userName = user != null ? user.getUsername() : "玩家";
        return ResponseEntity.ok(gameService.startGame(
            "single_" + System.currentTimeMillis(),
            List.of(userId), List.of(userName), aiLevel, totalRounds));
    }

    // ── Multiplayer: start room game ───────────────────────────────────
    @PostMapping("/room/{roomId}/start")
    public ResponseEntity<?> startRoom(@AuthenticationPrincipal User user,
                                        @PathVariable String roomId,
                                        @RequestBody(required = false) Map<String, Integer> params) {
        var room = roomRepo.findById(roomId)
            .orElseThrow(() -> new RuntimeException("Room not found"));

        if (!room.getHostId().equals(user.getId()))
            return ResponseEntity.status(403).body(Map.of("error", "只有房主可以開始遊戲"));

        int totalRounds = params != null ? params.getOrDefault("totalRounds", 4) : 4;
        List<String> ids   = room.getPlayerIds();
        List<String> names = ids.stream()
            .map(id -> userRepo.findById(id).map(User::getUsername).orElse("玩家"))
            .toList();

        room.setStatus(GameRoom.RoomStatus.PLAYING);
        roomRepo.save(room);

        var state = gameService.startGame(roomId, ids, names, room.getAiLevel(), totalRounds);
        return ResponseEntity.ok(state);
    }

    @GetMapping("/{roomId}")
    public ResponseEntity<GameState> getState(@AuthenticationPrincipal User user,
                                               @PathVariable String roomId) {
        String uid = user != null ? user.getId() : "p0";
        return ResponseEntity.ok(gameService.getState(roomId, uid));
    }

    @PostMapping("/{roomId}/action")
    public ResponseEntity<GameState> action(@AuthenticationPrincipal User user,
                                             @PathVariable String roomId,
                                             @RequestBody PlayerAction action) {
        String uid = user != null ? user.getId() : "p0";
        return ResponseEntity.ok(gameService.performAction(roomId, uid, action));
    }

    @PostMapping("/{roomId}/next-round")
    public ResponseEntity<GameState> nextRound(@PathVariable String roomId) {
        return ResponseEntity.ok(gameService.nextRound(roomId));
    }
}
